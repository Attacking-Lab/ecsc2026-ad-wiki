# List available recipes
default:
    @just --list

# Install dependencies into the uv-managed venv
[group('setup')]
sync:
    uv sync

# Serve the site locally with live reload
[group('dev')]
serve *ARGS: sync
    uv run mkdocs serve {{ARGS}}

# Build the static site into ./site
[group('build')]
build: sync
    uv run mkdocs build

# CI gate: build the site and surface any warnings
[group('build')]
check: sync
    uv run mkdocs build

# Remove build artifacts
[group('build')]
clean:
    rm -rf site

IMAGE := "oci.atklab.cloud/ecsc2026-ad-wiki/wiki"

# Build the container image (TAG defaults to "latest")
[group('docker')]
image-build TAG="latest":
    docker build -t {{IMAGE}}:{{TAG}} .

# Build and push the image to the registry
[group('docker')]
image-push TAG="latest": (image-build TAG)
    docker push {{IMAGE}}:{{TAG}}
