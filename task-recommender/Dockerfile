FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
# Install torch CPU-only first (avoids downloading 800MB CUDA build).
# The pip cache mount keeps downloaded wheels between builds, so even a
# cold rebuild doesn't re-download torch.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout=300 \
    torch --index-url https://download.pytorch.org/whl/cpu
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout=300 -r requirements.txt

COPY . .

# Ensure saved_models dir exists (pkl files are already copied in)
RUN mkdir -p saved_models

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
