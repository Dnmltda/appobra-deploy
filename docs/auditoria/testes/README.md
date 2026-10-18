# Testes de regressão do APP OBRA (servidor)

Rodam contra um PocketBase **local e isolado** — nunca contra produção.

```bash
# 1. Pasta isolada com o pacote que vai ser publicado
mkdir -p /tmp/appobra-teste && cd /tmp/appobra-teste
unzip -oq /caminho/do/repo/appobra_deploy_final.zip
chmod +x pocketbase

# 2. Migrations duas vezes (a segunda simula um restart de produção)
export PB_SUPERUSER_EMAIL=teste@local.test PB_SUPERUSER_PASSWORD='SenhaTeste123!'
./pocketbase migrate up --dir=./pb_data --migrationsDir=./pb_migrations --hooksDir=./pb_hooks
./pocketbase migrate up --dir=./pb_data --migrationsDir=./pb_migrations --hooksDir=./pb_hooks

# 3. Servidor na porta 8097
./pocketbase serve --http=127.0.0.1:8097 --dir=./pb_data --migrationsDir=./pb_migrations \
  --hooksDir=./pb_hooks --publicDir=./pb_public &

# 4. Duas empresas de teste pelo autocadastro real
for e in A B; do l=$(echo $e | tr A-Z a-z)
  curl -s -X POST http://127.0.0.1:8097/api/custom/self-register-company -H 'content-type: application/json' \
    -d "{\"companyName\":\"Empresa $e\",\"adminName\":\"Admin $e\",\"adminEmail\":\"$l@teste.local\",\"username\":\"admin$l\",\"password\":\"Senha12345\"}"
done

# 5. Testes
python3 -I /caminho/do/repo/docs/auditoria/testes/audit_tests.py resultado.json
```

Cada linha sai como `OK` ou `FALHA`. Resultado da auditoria de 18/10/2026: `resultado-2026-10-18.json`
(10 OK / 21 FALHA). O teste cria registros e altera o funcionário de teste, então rode sempre num
`pb_data` novo.
