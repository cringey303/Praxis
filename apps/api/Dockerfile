# Builder stage
FROM rust:1.89-slim-bookworm as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Enable SQLx offline mode
ENV SQLX_OFFLINE=true

# Copy manifest and lock file
COPY Cargo.toml Cargo.lock ./

# Create dummy src/main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm src/main.rs

# Copy source code
COPY . .

# Build the actual application
# We touch the main file to force a rebuild
RUN touch src/main.rs
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder stage
# Replace 'api' with your actual package name if different
COPY --from=builder /app/target/release/api /app/api

# Expose the port
ENV PORT=8080
EXPOSE 8080

# Run the binary
CMD ["./api"]
