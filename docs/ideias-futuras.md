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

## Nada se apaga durante o uso; só o fechamento da empresa apaga tudo (pedido do Diego, 25/10/2026)

**Regra:** enquanto a empresa usa o app, **ninguém apaga nada** (nem o Administrador). Os registros são a
auditoria da obra e ficam fixos, para não ter risco de adulteração. Se alguém **tentar** adulterar (apagar ou
mexer no que não pode), o sistema **avisa o dono do aplicativo (titular) e o responsável da empresa**.

**Fechamento da empresa ("apagar 100%"):** quando a empresa não quer mais usar o app, o responsável faz o
**backup completo** (dados, documentos e fotos) e só depois a empresa é apagada inteira, para ela não dizer que o
app ficou com algum dado dela. Se tentar apagar sem o backup, o sistema manda um e-mail para ele confirmar que se
responsabiliza pelos dados perdidos (a confirmar com o Diego: se essa opção existe ou se o backup é obrigatório).

Substitui o item M2 da auditoria de 24/10 ("arquivar em vez de apagar"). Decisões em aberto: o que pode ser
**editado** durante o uso (e com histórico); como o aviso de tentativa chega (e-mail na hora, resumo do dia,
notificação no app); quem é o "responsável" (quem cadastrou a empresa); formato do backup; prazo do link do e-mail.

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
