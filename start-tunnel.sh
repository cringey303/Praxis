#!/bin/bash
if ! command -v ngrok &> /dev/null; then
    echo "ngrok could not be found. Installing via Homebrew..."
    brew install ngrok/ngrok/ngrok
fi

echo "Starting ngrok tunnels..."
ngrok start --all --config="$HOME/Library/Application Support/ngrok/ngrok.yml" --config=./ngrok.yml
