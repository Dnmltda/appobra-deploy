# Logins de teste — Construtora Teste DNM (não apagar)

Empresa de teste do Diego em produção (https://appobra-backend.fly.dev e
https://midnightblue-chamois-688707.hostingersite.com), criada em 22/10/2026 com
`docs/auditoria/testes/empresa-teste.py`. Um login por cargo que o app aceita.

**As senhas não ficam no repositório.** Estão com o Diego; para conferir os logins, o script lê um
arquivo de senhas fora do repositório (`python3 -I empresa-teste.py conferir <URL> <arquivo>`).

| Cargo | E-mail (login) | Usuário |
|---|---|---|
| Administrador | `administrador@teste-appobra.invalid` | `teste.administrador` |
| Gerência | `gerencia@teste-appobra.invalid` | `teste.gerencia` |
| Engenheiro | `engenheiro@teste-appobra.invalid` | `teste.engenheiro` |
| Mestre de Obras | `mestre@teste-appobra.invalid` | `teste.mestre` |
| Almoxarife | `almoxarife@teste-appobra.invalid` | `teste.almoxarife` |
| Comprador | `comprador@teste-appobra.invalid` | `teste.comprador` |
| Financeiro | `financeiro@teste-appobra.invalid` | `teste.financeiro` |
| RH | `rh@teste-appobra.invalid` | `teste.rh` |
| Funcionário | `funcionario@teste-appobra.invalid` | `teste.funcionario` |
| Cliente | `cliente@teste-appobra.invalid` | `teste.cliente` |
| Pedreiro | `pedreiro@teste-appobra.invalid` | `teste.pedreiro` |
| Servente | `servente@teste-appobra.invalid` | `teste.servente` |
| Encanador | `encanador@teste-appobra.invalid` | `teste.encanador` |
| Eletricista | `eletricista@teste-appobra.invalid` | `teste.eletricista` |
| Faxina | `faxina@teste-appobra.invalid` | `teste.faxina` |

- Domínio `.invalid`: reservado, o servidor não manda e-mail para ele (`pb_hooks/titular.pb.js`).
- A empresa não tem limites e a limpeza de testes nunca a apaga (nome terminado em "(não apagar)").
- Conferido em 22/10/2026 em produção: os 15 entram (servidor e telas), sem erro, e nenhum vê dados de outra
  empresa (19 tabelas).
