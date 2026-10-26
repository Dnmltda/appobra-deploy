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

Substitui o item M2 da auditoria de 24/10 ("arquivar em vez de apagar").

**Decisões do Diego (25/10/2026):**
1. **Editar:** cadastros podem ser corrigidos, com histórico (quem, quando, valor antigo e novo); registros
   fechados (movimentação aprovada, entrega de EPI, pedido concluído) não mudam, correção é lançamento novo.
   **Material que está no saldo de qualquer funcionário não pode ser alterado** (nem nome, nem tamanho, nada); o
   saldo só baixa pelo uso registrado.
2. **Avisos:** sino do app sempre, na hora. No fim do expediente, **"Movimentações do dia"** de cada pessoa dentro
   do app (o que ela movimentou, o que adicionou, o que mandaram para ela, o que tentaram fazer e foi barrado).
   No fechamento da semana vira o **PDF "Movimentações da semana"**, para baixar. E-mail só o mínimo (economizar
   a cota da Brevo). O Diego pediu um **exemplo** antes de construir.
3. **Fechamento sem backup:** pode, mas aparece **outra página** em que o responsável confirma que está de acordo
   e abre mão de todos os dados, que tudo será apagado sob a responsabilidade dele.

Ainda em aberto: quem é o "responsável" (quem cadastrou a empresa); formato do backup.

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

## Escondido até ficar pronto (Bloco 4, aprovado pelo Diego em 26/10/2026)
Estavam visíveis como "em desenvolvimento"; o código das telas continua no projeto e volta quando terminar:
- Telas: Escalas (RH), Licenciamento e Quilometragem (Frota) — as rotas foram tiradas do `App.jsx`.
- Botões: "Nova Equipe" (RH), "Novo Registro" de abastecimento e "Nova Manutenção" (Frota), "Exportar" da Auditoria.
- Configurações: "Exportar/Importar backup" (era simulado). O backup de verdade entra junto com o
  fechamento da empresa (seção acima).
- Juntar as tabelas repetidas: fica para a mesma etapa do backup de verdade (Diego, 26/10/2026).
