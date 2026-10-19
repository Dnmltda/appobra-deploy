# Login por usuário (sem diferenciar maiúscula) e por ID ("1" = "01"), e a pessoa escolhendo o
# próprio usuário (perfil e convite). Uso (servidor local novo, empresas A e B criadas):
#   python3 -I usuario_login.py <pb_data/data.db>
import json, sys, sqlite3, urllib.request, urllib.error
API="http://127.0.0.1:8097"; DB=sys.argv[1]
def req(m, path, body=None, tok=None):
    r=urllib.request.Request(API+path, method=m, data=json.dumps(body).encode() if body is not None else None, headers={"content-type":"application/json", **({"Authorization":tok} if tok else {})})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as x: return x.code, json.loads(x.read() or b"{}")
ok=lambda c,n: print(("OK   " if c else "FALHA"), n)
st=req("POST","/api/collections/_superusers/auth-with-password",{"identity":"teste@local.test","password":"SenhaTeste123!"})[1]["token"]
def u(email): return req("GET",f"/api/collections/users/records?filter=email%3D%22{email.replace('@','%40')}%22",tok=st)[1]["items"][0]
A=u("a@teste.local"); B=u("b@teste.local")
# B com outra senha, para o ID 01 não repetir senha entre empresas
req("PATCH",f"/api/collections/users/records/{B['id']}",{"password":"SenhaB12345","passwordConfirm":"SenhaB12345"},st)
# conta antiga com maiúscula no usuário (gravada direto no banco)
db=sqlite3.connect(DB); db.execute("update users set username='Diego.Teste' where id=?",(A["id"],)); db.commit(); db.close()
for ident in ["diego.teste","DIEGO.TESTE"," Diego.Teste "]:
    c,b=req("POST","/api/custom/login-usuario",{"username":ident.strip().lower(),"password":"Senha12345"})
    ok(c==200 and b.get("record",{}).get("id")==A["id"], f"login por usuário antigo com maiúscula ('{ident}') ({c})")
c,b=req("POST","/api/custom/login-usuario",{"username":"diego.teste","password":"errada123"})
ok(c==400 and "incorretos" in b.get("message",""), "senha errada pelo usuário: mensagem clara")
for ident in ["1","01","001"]:
    c,b=req("POST","/api/custom/login-id",{"id_unico":ident,"password":"Senha12345"})
    ok(c==200 and b.get("record",{}).get("id")==A["id"], f"login pelo ID '{ident}' ({c} {b.get('message','')})")
tokA=req("POST","/api/custom/login-id",{"id_unico":"01","password":"Senha12345"})[1]["token"]
# perfil: trocar o próprio usuário
c,b=req("PATCH",f"/api/collections/users/records/{A['id']}",{"username":"meu nome"},tokA)
ok(c==400 and "inválido" in b.get("message",""), f"usuário com espaço é recusado com mensagem ({c})")
c,b=req("PATCH",f"/api/collections/users/records/{A['id']}",{"username":"Diego.Novo"},tokA)
ok(c==200 and b.get("username")=="diego.novo", f"pessoa troca o próprio usuário (gravado minúsculo) ({c} {b.get('username')})")
c,_=req("POST","/api/custom/login-usuario",{"username":"diego.novo","password":"Senha12345"})
ok(c==200, "entra com o usuário novo")
tokB=req("POST","/api/collections/users/auth-with-password",{"identity":"b@teste.local","password":"SenhaB12345"})[1]["token"]
c,b=req("PATCH",f"/api/collections/users/records/{B['id']}",{"username":"DIEGO.NOVO"},tokB)
ok(c==400 and "em uso" in b.get("message",""), f"usuário já em uso (mesmo com maiúscula) é recusado ({c})")
c,b=req("PATCH",f"/api/collections/users/records/{A['id']}",{"telefone":"11999990000"},tokA)
ok(c==200, "salvar outros dados do perfil continua funcionando")
# convite: pessoa escolhe o usuário ao criar a senha
tok="t"*40
c,b=req("POST","/api/collections/users/records",{"email":"conv@teste.local","username":"conv.sugerido","name":"Conv","password":"Tmp123456x","passwordConfirm":"Tmp123456x","company_id":A["company_id"],"status":"Inativo","cargo":"Pedreiro","role":"Pedreiro","password_reset_token":tok,"password_reset_expires":"2099-01-01 00:00:00.000Z"},tokA)
ok(c==200, f"admin cria acesso com convite ({c} {b.get('message','')})")
c,b=req("POST","/api/custom/get-invite-details",{"token":tok})
ok(c==200 and b.get("username")=="conv.sugerido" and b.get("id_unico"), f"convite mostra usuário sugerido e ID ({b.get('id_unico')})")
c,b=req("POST","/api/custom/activate-invite",{"token":tok,"password":"Conv12345x","passwordConfirm":"Conv12345x","username":"diego.novo"})
ok(c==400 and "em uso" in b.get("message",""), f"convite: usuário em uso é recusado ({c})")
c,b=req("POST","/api/custom/activate-invite",{"token":tok,"password":"Conv12345x","passwordConfirm":"Conv12345x","username":"Joao.Escolhido"})
ok(c==200, f"convite: pessoa escolhe o usuário e ativa ({c} {b.get('message','')})")
c,b=req("POST","/api/custom/login-usuario",{"username":"joao.escolhido","password":"Conv12345x"})
ok(c==200, "entra com o usuário escolhido no convite")
