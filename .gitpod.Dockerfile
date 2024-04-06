FROM gitpod/workspace-full-vnc

RUN sudo apt-get update && \
    # Upgrading Packages
    sudo apt upgrade -y && \
    # Tauri Packages
    sudo apt install -y libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev && \
    # Serial Packages
    sudo apt install -y libudev-dev && \
    # Protobuf Packages
    sudo apt install -y protobuf-compiler && \
    sudo rm -rf /var/lib/apt/lists/*