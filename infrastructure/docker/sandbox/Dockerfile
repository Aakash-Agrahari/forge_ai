FROM node:24-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        openjdk-17-jdk-headless \
        build-essential \
        ca-certificates \
        git \
    && rm -rf /var/lib/apt/lists/*

RUN node --version \
    && npm --version \
    && python3 --version \
    && java -version \
    && javac -version \
    && gcc --version \
    && g++ --version \
    && git --version

WORKDIR /workspace

CMD ["sh"]