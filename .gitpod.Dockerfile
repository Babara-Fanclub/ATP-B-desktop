FROM gitpod/workspace-full-vnc

RUN sudo apt-get update && \
    sudo apt install -y libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev && \
    sudo rm -rf /var/lib/apt/lists/*