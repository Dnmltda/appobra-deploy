FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY appobra_deploy_final.zip ./appobra_deploy_final.zip
RUN unzip -o appobra_deploy_final.zip -d /app/extracted \
    && rm appobra_deploy_final.zip \
    && chmod +x /app/extracted/pocketbase

COPY fly-entrypoint.sh /app/entrypoint.sh
# Tira o fim de linha do Windows (CRLF), se o repositório foi baixado no Windows:
# com "\r" no "#!/bin/sh" o Linux não acha o interpretador ("os error 2").
RUN sed -i 's/\r$//' /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
