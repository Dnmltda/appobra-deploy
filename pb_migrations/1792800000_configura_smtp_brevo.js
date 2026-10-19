/// <reference path="../pb_data/types.d.ts" />
// Esta migration configurava o SMTP do Brevo com a chave escrita no código,
// e essa chave acabou publicada no GitHub (repositório público). A chave
// foi revogada e a configuração passou para pb_hooks/smtp-from-env.pb.js,
// que lê BREVO_SMTP_LOGIN / BREVO_SMTP_KEY das variáveis de ambiente.
//
// Mantida como no-op (mesmo nome de arquivo) para não quebrar bancos onde
// ela já consta como aplicada.
migrate((app) => {
}, (app) => {
})
