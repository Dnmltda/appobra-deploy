# Limite de 2 trocas de senha por semana e troca de senha pelo administrador.
# Uso (servidor local novo, empresas A e B criadas, smtp_sink.py na porta 2525):
#   python3 -I limite_senha.py <pasta-do-smtp_sink>
import json, os, sys, urllib.request, urllib.error
API="http://127.0.0.1:8097"; SINK=sys.argv[1]
def req(m, path, body=None, tok=None):
    r=urllib.request.Request(API+path, method=m, data=json.dumps(body).encode() if body is not None else None, headers={"content-type":"application/json", **({"Authorization":tok} if tok else {})})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as x: return x.code, json.loads(x.read() or b"{}")
ok=lambda c,n: print(("OK   " if c else "FALHA"), n)
_,su=req("POST","/api/collections/_superusers/auth-with-password",{"identity":"teste@local.test","password":"SenhaTeste123!"}); st=su["token"]
req("PATCH","/api/settings",{"smtp":{"enabled":True,"host":"127.0.0.1","port":2525,"username":"","password":"","tls":False}},st)
def login(i,p): c,b=req("POST","/api/collections/users/auth-with-password",{"identity":i,"password":p}); return b.get("token"), b.get("record",{})
tok,rec=login("a@teste.local","Senha12345"); uid=rec["id"]
ok("trocas_senha" not in rec, "campo oculto não sai na resposta")
senhas=["Senha12345","Nova12345a","Nova12345b","Nova12345c"]
for i in range(3):
    c,b=req("PATCH",f"/api/collections/users/records/{uid}",{"oldPassword":senhas[i],"password":senhas[i+1],"passwordConfirm":senhas[i+1]},tok)
    if i<2:
        ok(c==200, f"troca {i+1} pelo perfil aceita ({c})"); tok,_=login("a@teste.local",senhas[i+1])
    else:
        ok(c==400 and "2 vezes" in b.get("message",""), f"troca 3 barrada: {c} {b.get('message')}")
c,_=req("PATCH",f"/api/collections/users/records/{uid}",{"trocas_senha":""},tok)
u=req("GET",f"/api/collections/users/records/{uid}",tok=st)[1]
ok(len(u.get("trocas_senha","").split(","))==2, f"usuário não zera o contador (status {c})")
# esqueci-senha: B (admin da empresa B) pede 3 vezes
def emails():
    return len(os.listdir(SINK)) if os.path.isdir(SINK) else 0
n0=emails()
for i in range(3):
    c,b=req("POST","/api/custom/esqueci-senha",{"identificador":"b@teste.local"}); ok(c==200 and b.get("success"), f"esqueci {i+1}: mesma resposta")
import time; time.sleep(1)
ok(emails()-n0==2, f"só 2 e-mails de recuperação saíram ({emails()-n0})")
# A atingiu o limite pelo perfil: esqueci-senha não envia
n1=emails(); req("POST","/api/custom/esqueci-senha",{"identificador":"a@teste.local"}); time.sleep(1)
ok(emails()-n1==0, "perfil + esqueci somam no mesmo limite")
# Admin troca a senha de outro usuário da mesma empresa: não conta
tokA,_=login("a@teste.local","Nova12345b")
c,b=req("POST","/api/collections/users/records",{"email":"c@teste.local","username":"userc","password":"Senha12345","passwordConfirm":"Senha12345","company_id":rec["company_id"],"status":"Ativo","is_active":True,"cargo":"Almoxarife"},tokA)
cid=b.get("id"); ok(c==200, f"admin cria usuário C ({c} {b.get('message','')})")
for i in range(3):
    c,b=req("PATCH",f"/api/collections/users/records/{cid}",{"password":f"Temp1234{i}x","passwordConfirm":f"Temp1234{i}x"},tokA)
    ok(c==200, f"admin troca senha do C, vez {i+1} ({c} {b.get('message','')})")
tokC,_=login("c@teste.local","Temp12342x")
ok(tokC is not None, "C entra com a senha que o admin definiu")
_,bB=req("GET","/api/collections/users/records?filter=email%3D%22b%40teste.local%22",tok=st); bid=bB["items"][0]["id"]
c,_=req("PATCH",f"/api/collections/users/records/{bid}",{"password":"Hack12345x","passwordConfirm":"Hack12345x"},tokA)
ok(c in (400,403,404), f"admin A NÃO troca senha de usuário da empresa B ({c})")
c,_=req("PATCH",f"/api/collections/users/records/{uid}",{"password":"Hack12345x","passwordConfirm":"Hack12345x"},tokC)
ok(c in (400,403,404), f"usuário comum C NÃO troca senha do admin A ({c})")
c,b=req("PATCH",f"/api/collections/users/records/{uid}",{"oldPassword":"Nova12345b","password":"Nova12345z","passwordConfirm":"Nova12345z"},tokA)
ok(c==400 and "2 vezes" in b.get("message",""), f"admin também respeita o limite na própria senha ({c})")
# Admin da empresa da conta Master não troca a senha do Master
_,m=req("GET","/api/collections/users/records?filter=email%3D%22dnmltda%40hotmail.com%22",tok=st)
if m.get("items"):
    mest=m["items"][0]
    req("POST","/api/collections/users/records",{"email":"x@teste.local","username":"userx","password":"Senha12345","passwordConfirm":"Senha12345","company_id":mest["company_id"],"status":"Ativo","is_active":True,"cargo":"Administrador","role":"admin"},st)
    tokX,_=login("x@teste.local","Senha12345")
    c,_=req("PATCH",f"/api/collections/users/records/{mest['id']}",{"password":"Hack12345x","passwordConfirm":"Hack12345x"},tokX)
    ok(c in (400,403,404), f"admin da empresa do Master NÃO troca a senha do Master ({c})")
