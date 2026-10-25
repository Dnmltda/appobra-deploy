# Ideias futuras do APP OBRA (anotadas, não fazer agora)

Registradas a pedido do Diego em 21/10/2026. Só entram **depois** que existir, no site da DNM&LTDA, uma área
de login e senha para membros (com exclusividades e, no futuro, descontos com parceiros como Woltrix e
Navarro). Até lá o app fica como está.

## Para quando o app for aberto/vendido

- **Liga/desliga de módulos por empresa** (configuração central, sem apagar código). Câmeras desligadas por
  padrão. O titular liga e desliga as ferramentas de cada empresa cliente pelo menu dele.
- **Conta de demonstração** para quem quer conhecer o app.
- **Aviso fixo em todas as telas:** "Protótipo em teste — versão em desenvolvimento pela DNM&LTDA".
- **Botão "Deixar opinião"** em todas as telas (texto, nota de 1 a 5, tela, data, usuário), visível só para o
  titular, com uma tela para ler as opiniões.
- **Termos e privacidade (LGPD):** página curta (é teste, dados podem ser apagados, não usar dados sensíveis
  reais) com aceite obrigatório no cadastro, conferido pelo servidor.
- **Planos:** limites por empresa (logins, funcionários, materiais, obras) já começam a existir para as
  empresas de teste; os planos pagos só mudam os números.

## Backup e exclusão total pelo responsável da empresa (pedido do Diego, 25/10/2026)

Fazer **depois que o app estiver ativo** (no lugar do item M2 da auditoria de 24/10, "arquivar em vez de apagar",
que fica adiado). Ideia do Diego:

- O **responsável** pela empresa (quem cadastrou a empresa no app) pode **fazer um backup** dos dados da empresa.
- Depois disso ele tem a opção de **apagar 100% dos dados** da empresa no banco.
- Se ele tentar apagar **sem ter feito o backup**, o sistema percebe e **manda um e-mail** para ele confirmar que
  se responsabiliza pelos dados perdidos. Só depois da confirmação pelo e-mail a exclusão acontece.

Decisões em aberto (perguntar ao Diego antes de construir): quem conta como "responsável" (só quem cadastrou ou
qualquer Administrador); formato do backup (arquivo para baixar com planilhas + fotos/documentos, ou guardado no
servidor); se "apagar 100%" fecha a empresa inteira (logins incluídos) ou só limpa os dados; quanto tempo o backup
vale (ex.: feito nas últimas 24 horas); prazo do link do e-mail e se há um período para desistir depois de
confirmar.

## Regra do titular

- **Hoje:** o e-mail `dnmltda@hotmail.com` é sempre o administrador (dono do sistema e superusuário do
  PocketBase) e pode mexer em todas as empresas e logins.
- **Quando o app for vendido:** o titular **não** cancela, não altera nem mexe indiretamente nos logins e nos
  dados das empresas clientes. Só liga e desliga as ferramentas (módulos) de cada empresa pelo menu dele.

## Outras ideias já citadas

- Câmeras fixas (CFTV) da obra tirando a foto da troca/retirada sozinhas (hoje: câmera do celular/tablet; o
  local e a hora ficam registrados para achar na gravação).
- Domínio próprio para os e-mails (sair do spam).
- Juntar as tabelas repetidas que têm dados (companies/empresas, audit_logs/auditoria, campos
  inglês/português), na revisão de segurança antes de vender.
