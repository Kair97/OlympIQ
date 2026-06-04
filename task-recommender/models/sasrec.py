"""
Model 3: SASRec — Self-Attentive Sequential Recommendation.
Treats a user's solve history as a learning journey and predicts the next problem.

Architecture: causal Transformer (like GPT) trained on problem sequences.
Loss: BPR (Bayesian Personalized Ranking) — rank positives above negatives.
"""

import numpy as np
import torch
import torch.nn as nn
import pickle
import os
from tqdm import tqdm
from config import (
    SASREC_EMBED_DIM, SASREC_NUM_HEADS, SASREC_NUM_LAYERS,
    SASREC_MAX_LEN, SASREC_DROPOUT, SASREC_LR,
    SASREC_BATCH, SASREC_EPOCHS, MODELS_DIR,
)
import database as db
from features.user_features import build_user_solve_sequence


# ─── Model definition ─────────────────────────────────────────────────────────
class SASRecBlock(nn.Module):
    """One transformer block: pre-norm self-attention + FFN."""

    def __init__(self, embed_dim: int, num_heads: int, dropout: float):
        super().__init__()
        self.norm1 = nn.LayerNorm(embed_dim)
        self.norm2 = nn.LayerNorm(embed_dim)
        self.attn  = nn.MultiheadAttention(
            embed_dim, num_heads,
            dropout=dropout,
            batch_first=True,
        )
        self.ffn = nn.Sequential(
            nn.Linear(embed_dim, embed_dim * 4),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(embed_dim * 4, embed_dim),
            nn.Dropout(dropout),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor,
                causal_mask: torch.Tensor,
                pad_mask: torch.Tensor) -> torch.Tensor:
        # Pre-norm self-attention
        residual = x
        x = self.norm1(x)
        attn_out, _ = self.attn(
            x, x, x,
            attn_mask        = causal_mask,
            key_padding_mask = pad_mask,
            need_weights     = False,
        )
        x = residual + self.dropout(attn_out)

        # Pre-norm FFN
        residual = x
        x = self.norm2(x)
        x = residual + self.ffn(x)
        return x


class SASRecNet(nn.Module):
    """Full SASRec network."""

    def __init__(self, num_items: int, embed_dim: int = 64,
                 num_heads: int = 4, num_layers: int = 2,
                 max_len: int = 50, dropout: float = 0.1):
        super().__init__()
        self.max_len   = max_len
        self.embed_dim = embed_dim
        self.num_items = num_items

        # +1 because 0 is padding token
        self.item_emb = nn.Embedding(num_items + 1, embed_dim, padding_idx=0)
        self.pos_emb  = nn.Embedding(max_len, embed_dim)
        self.drop     = nn.Dropout(dropout)

        self.blocks = nn.ModuleList([
            SASRecBlock(embed_dim, num_heads, dropout)
            for _ in range(num_layers)
        ])
        self.out_norm = nn.LayerNorm(embed_dim)

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Embedding):
                nn.init.normal_(m.weight, std=0.02)
                if m.padding_idx is not None:
                    m.weight.data[m.padding_idx].zero_()
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, std=0.02)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def encode(self, seqs: torch.Tensor) -> torch.Tensor:
        """
        Encode a batch of sequences.
        seqs : (B, L)  — item ids, 0 = padding
        out  : (B, L, D)
        """
        B, L   = seqs.shape
        device = seqs.device

        positions  = torch.arange(L, device=device).unsqueeze(0).expand(B, -1)
        x          = self.item_emb(seqs) + self.pos_emb(positions)
        x          = self.drop(x)

        # Causal mask: True = mask (upper triangle excluding diagonal)
        causal = torch.triu(
            torch.ones(L, L, dtype=torch.bool, device=device), diagonal=1
        )
        # Padding mask: True = padding token (ignore in attention)
        pad_mask = (seqs == 0)   # (B, L)

        for block in self.blocks:
            x = block(x, causal, pad_mask)

        return self.out_norm(x)

    def last_repr(self, seqs: torch.Tensor) -> torch.Tensor:
        """
        Return the representation at the last *non-padding* position.
        out : (B, D)
        """
        enc = self.encode(seqs)   # (B, L, D)

        # Find last non-padding index for each sequence
        non_pad  = (seqs != 0).long()                  # (B, L)
        lengths  = non_pad.sum(dim=1) - 1              # (B,) last index
        lengths  = lengths.clamp(min=0)
        idx      = lengths.unsqueeze(-1).unsqueeze(-1)  # (B, 1, 1)
        idx      = idx.expand(-1, 1, enc.size(-1))      # (B, 1, D)
        out      = enc.gather(1, idx).squeeze(1)        # (B, D)
        return out

    def forward(self, seqs: torch.Tensor,
                pos_items: torch.Tensor,
                neg_items: torch.Tensor):
        """
        Training forward pass (BPR loss).
        seqs      : (B, L)
        pos_items : (B,)
        neg_items : (B,)
        """
        h         = self.last_repr(seqs)              # (B, D)
        pos_emb   = self.item_emb(pos_items)          # (B, D)
        neg_emb   = self.item_emb(neg_items)          # (B, D)
        pos_score = (h * pos_emb).sum(-1)             # (B,)
        neg_score = (h * neg_emb).sum(-1)             # (B,)
        return pos_score, neg_score

    def score_candidates(self, seq: torch.Tensor,
                         candidates: torch.Tensor) -> torch.Tensor:
        """
        seq        : (1, L) single user sequence
        candidates : (C,)   candidate item ids
        returns    : (C,)   scores
        """
        h    = self.last_repr(seq)                    # (1, D)
        embs = self.item_emb(candidates)              # (C, D)
        return (embs * h).sum(-1)                     # (C,)


# ─── Trainer ──────────────────────────────────────────────────────────────────
class SASRecModel:
    """Train, save, load, and predict with SASRec."""

    def __init__(self):
        self.net         = None
        self.item_to_idx = {}    # problem_db_id → 1-based index
        self.idx_to_item = {}
        self.device      = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # ─── Vocabulary ──────────────────────────────────────────────────────────
    def _build_vocab(self, sequences: list) -> int:
        all_items = {item for seq in sequences for item in seq}
        self.item_to_idx = {item: idx + 1 for idx, item in enumerate(sorted(all_items))}
        self.idx_to_item = {v: k for k, v in self.item_to_idx.items()}
        return len(self.item_to_idx)

    def _encode_seq(self, seq: list, max_len: int) -> list:
        idxs = [self.item_to_idx[x] for x in seq if x in self.item_to_idx]
        if len(idxs) > max_len:
            idxs = idxs[-max_len:]
        return [0] * (max_len - len(idxs)) + idxs

    # ─── Dataset preparation ─────────────────────────────────────────────────
    def _build_dataset(self, sequences: list, max_len: int):
        """
        For each user, for each position in their sequence,
        create (padded_input, next_item) sample.
        Returns list of (input_seq, target_idx).
        """
        samples = []
        for seq in sequences:
            idx_seq = [self.item_to_idx[x] for x in seq if x in self.item_to_idx]
            if len(idx_seq) < 2:
                continue
            # Sliding window
            for end in range(2, min(len(idx_seq), max_len + 2) + 1):
                inp    = idx_seq[max(0, end - max_len - 1):end - 1]
                target = idx_seq[end - 1]
                # Pad
                pad_inp = [0] * (max_len - len(inp)) + inp
                samples.append((pad_inp, target))
        return samples

    # ─── Training ─────────────────────────────────────────────────────────────
    def fit(self, sequences: list = None):
        if sequences is None:
            from features.user_features import build_all_sequences
            sequences = build_all_sequences()

        if len(sequences) < 5:
            print("Not enough sequences for SASRec (need ≥5 users). Skipping.")
            return

        num_items = self._build_vocab(sequences)
        print(f"SASRec vocab: {num_items} unique problems")

        dataset = self._build_dataset(sequences, SASREC_MAX_LEN)
        print(f"SASRec training samples: {len(dataset)}")

        if len(dataset) < 10:
            print("Too few samples. Skipping SASRec training.")
            return

        self.net = SASRecNet(
            num_items  = num_items,
            embed_dim  = SASREC_EMBED_DIM,
            num_heads  = SASREC_NUM_HEADS,
            num_layers = SASREC_NUM_LAYERS,
            max_len    = SASREC_MAX_LEN,
            dropout    = SASREC_DROPOUT,
        ).to(self.device)

        optimizer  = torch.optim.Adam(self.net.parameters(), lr=SASREC_LR,
                                       weight_decay=1e-5)
        scheduler  = torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer, T_max=SASREC_EPOCHS
        )

        print(f"Training SASRec on {self.device} for {SASREC_EPOCHS} epochs...")
        self.net.train()

        for epoch in range(SASREC_EPOCHS):
            np.random.shuffle(dataset)
            total_loss = 0.0
            n_batches  = 0

            for i in range(0, len(dataset), SASREC_BATCH):
                batch   = dataset[i:i + SASREC_BATCH]
                seqs_t  = torch.tensor([s[0] for s in batch],
                                        dtype=torch.long, device=self.device)
                pos_t   = torch.tensor([s[1] for s in batch],
                                        dtype=torch.long, device=self.device)

                # Vectorized negative sampling with collision avoidance
                pos_ids = np.array([s[1] for s in batch])
                neg_ids = np.random.randint(1, num_items + 1, size=len(batch))
                collisions = neg_ids == pos_ids
                neg_ids[collisions] = (neg_ids[collisions] % num_items) + 1
                neg_t = torch.tensor(neg_ids, dtype=torch.long, device=self.device)

                pos_s, neg_s = self.net(seqs_t, pos_t, neg_t)
                loss = -torch.log(torch.sigmoid(pos_s - neg_s) + 1e-8).mean()

                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(self.net.parameters(), 1.0)
                optimizer.step()

                total_loss += loss.item()
                n_batches  += 1

            scheduler.step()
            if (epoch + 1) % 10 == 0:
                print(f"  Epoch {epoch+1}/{SASREC_EPOCHS}  "
                      f"loss={total_loss/max(n_batches,1):.4f}")

        print("SASRec training complete.")

    # ─── Predict ──────────────────────────────────────────────────────────────
    def predict(self, user_db_id: int,
                candidate_problem_db_ids: list) -> dict:
        if self.net is None:
            return {pid: 0.0 for pid in candidate_problem_db_ids}

        self.net.eval()
        seq = build_user_solve_sequence(user_db_id)
        enc = self._encode_seq(seq, SASREC_MAX_LEN)

        seq_t = torch.tensor([enc], dtype=torch.long, device=self.device)

        cand_idx  = []
        valid_ids = []
        for pid in candidate_problem_db_ids:
            i = self.item_to_idx.get(pid)
            if i is not None:
                cand_idx.append(i)
                valid_ids.append(pid)

        if not cand_idx:
            return {pid: 0.0 for pid in candidate_problem_db_ids}

        cand_t = torch.tensor(cand_idx, dtype=torch.long, device=self.device)

        with torch.no_grad():
            scores = self.net.score_candidates(seq_t, cand_t).cpu().numpy()

        # Normalize
        lo, hi = scores.min(), scores.max()
        if hi > lo:
            scores = (scores - lo) / (hi - lo)

        result = {pid: 0.0 for pid in candidate_problem_db_ids}
        for pid, s in zip(valid_ids, scores.tolist()):
            result[pid] = float(s)
        return result

    # ─── Save / Load ──────────────────────────────────────────────────────────
    def save(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "sasrec.pkl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        payload = {
            "item_to_idx": self.item_to_idx,
            "idx_to_item": self.idx_to_item,
            "net_state":   self.net.state_dict() if self.net else None,
            "net_config":  {
                "num_items":  len(self.item_to_idx),
                "embed_dim":  SASREC_EMBED_DIM,
                "num_heads":  SASREC_NUM_HEADS,
                "num_layers": SASREC_NUM_LAYERS,
                "max_len":    SASREC_MAX_LEN,
                "dropout":    SASREC_DROPOUT,
            } if self.net else None,
        }
        with open(path, "wb") as f:
            pickle.dump(payload, f)
        print(f"SASRec saved → {path}")

    def load(self, path: str = None):
        path = path or os.path.join(MODELS_DIR, "sasrec.pkl")
        if not os.path.exists(path):
            print(f"No SASRec model at {path}")
            return
        with open(path, "rb") as f:
            data = pickle.load(f)
        self.item_to_idx = data["item_to_idx"]
        self.idx_to_item = data["idx_to_item"]
        if data.get("net_state"):
            cfg      = data["net_config"]
            self.net = SASRecNet(**cfg).to(self.device)
            self.net.load_state_dict(data["net_state"])
            self.net.eval()
        print(f"SASRec loaded ← {path}")
