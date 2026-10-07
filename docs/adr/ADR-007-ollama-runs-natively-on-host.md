# Ollama runs natively on the host, not in Docker Compose

Ollama is the one runtime dependency deliberately absent from `docker-compose.yml`. Docker Desktop on macOS runs containers in a Linux VM with no access to the Apple GPU (Metal), so a containerised Ollama falls back to CPU and runs a 7B model roughly 3–5× slower — decisive when a Backfill means thousands of classification calls. The backend reaches the host's Ollama through `OLLAMA_BASE_URL` (`http://localhost:11434` natively, `http://host.docker.internal:11434` from a container) and the collector refuses to boot if Ollama is unreachable or the configured model is not pulled (the API does not depend on Ollama — see ADR-009).

## Considered Options

- **`ollama` service in Docker Compose** — one fewer install step, but CPU-only on macOS. Worth it only on a Linux host with an NVIDIA GPU and the container toolkit; documented in the README as an option, not built.

## Consequences

- Setup has one host prerequisite beyond Docker: Ollama itself, with `qwen2.5:7b` pulled.
- Cloud deployment is out of scope for this project, so how Ollama would run on ECS is not decided here.
