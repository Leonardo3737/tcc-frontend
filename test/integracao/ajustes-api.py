"""Verifica os ajustes A1-A4/B1-B2 ATRAVES do frontend (proxy /api/backend).

Nao chama o NestJS direto: passa pelo cookie httpOnly e pelo proxy do Next, que
e o caminho que o navegador percorre. Exercita exatamente o que a interface
consome, com os mesmos parametros.

Uso:  py -I test/integracao/ajustes-api.py     (frontend em 3001, backend em 3000)
"""

import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

BASE = 'http://localhost:3001'
API = BASE + '/api/backend'
ALUNA = '22222222-2222-4222-8222-222222222222'

ok = 0
falhas = []


def chamar(metodo, url, cookie=None, corpo=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo)
    req.add_header('Content-Type', 'application/json')
    if cookie:
        req.add_header('Cookie', cookie)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            texto = r.read().decode()
            return r.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        return e.code, (json.loads(texto) if texto else None)


def verificar(descricao, condicao, detalhe=''):
    global ok
    if condicao:
        ok += 1
        print(f'  OK    {descricao} {detalhe}')
    else:
        falhas.append(descricao)
        print(f'  FALHA {descricao} {detalhe}')


def entrar(email):
    dados = json.dumps({'email': email, 'senha': 'senhaSegura123'}).encode()
    req = urllib.request.Request(BASE + '/api/bff/login', data=dados, method='POST')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.headers.get('Set-Cookie', '').split(';')[0]


# --------------------------------------------------------------- configuracao

print('\n== B1: duracaoPadraoMinutos em /configuracao ==')
st, cfg = chamar('GET', API + '/configuracao')
limites = (cfg or {}).get('agendamento', {})
verificar('configuracao responde', st == 200, f'({st})')
verificar('expoe duracaoPadraoMinutos', 'duracaoPadraoMinutos' in limites,
          f"({limites.get('duracaoPadraoMinutos')})")
verificar('padrao dentro de [minima, maxima]',
          limites['duracaoMinimaMinutos'] <= limites['duracaoPadraoMinutos']
          <= limites['duracaoMaximaMinutos'])

# tzdata nao esta instalado nesta maquina, entao o offset vem fixo a partir do
# fuso que a propria API declara — mesma ponte que o frontend faz com TZDate.
OFFSETS = {'America/Porto_Velho': -4, 'America/Sao_Paulo': -3, 'America/Manaus': -4}
fuso_nome = cfg['fusoHorario']
verificar('fuso da instituicao conhecido por este script', fuso_nome in OFFSETS, f'({fuso_nome})')
FUSO = timezone(timedelta(hours=OFFSETS[fuso_nome]))
PADRAO = limites['duracaoPadraoMinutos']


def instante(base_local, hora, minuto=0):
    """Instante UTC correspondente a hora LOCAL da instituicao."""
    local = base_local.replace(hour=hora, minute=minuto, second=0, microsecond=0, tzinfo=FUSO)
    return local.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


sufixo = str(int(time.time()))[-6:]
agora_local = datetime.now(FUSO)
# Dois dias a frente: fora de qualquer antecedencia minima e dentro da janela.
dia_alvo = (agora_local + timedelta(days=2)).replace(tzinfo=None)

print('\n== Sessoes ==')
prof = entrar('joao.ribeiro@ufx.edu.br')
alu = entrar('ana.martins@ufx.edu.br')
verificar('login do professor', bool(prof))
verificar('login da aluna', bool(alu))

print('\n== Cenario ==')
st, disc = chamar('POST', API + '/disciplinas', prof,
                  {'nome': f'Ajustes API {sufixo}'})
verificar('cria disciplina', st == 201, f'({st})')

st, mon = chamar('POST', API + '/monitorias', prof,
                 {'disciplinaId': disc['id'], 'ano': 2026, 'semestre': 2,
                  'descricao': 'Verificacao dos ajustes A1-A4'})
verificar('cria monitoria', st == 201, f'({st})')
mid = mon['id']

chamar('POST', f'{API}/monitorias/{mid}/ativar', prof)

st, monitor = chamar('POST', f'{API}/monitorias/{mid}/monitores', prof, {'alunoId': ALUNA})
verificar('habilita aluna como MONITOR', st == 201 and monitor['papel'] == 'MONITOR')
vinculo = monitor['id']

# Disponibilidade no dia alvo, 08:00-20:00 — janela larga para gerar slots.
st, faixa = chamar('POST', f'{API}/monitorias/{mid}/disponibilidades', alu,
                   {'diaSemana': dia_alvo.weekday() + 1 if dia_alvo.weekday() < 6 else 0,
                    'horaInicio': '08:00', 'horaFim': '20:00'})
verificar('monitora declara disponibilidade', st == 201, f'({st})')

# ------------------------------------------------------------------------ A1

print('\n== A1: horarios-livres ==')
de = agora_local.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
ate = (agora_local + timedelta(days=21)).astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

st, livres = chamar('GET', f'{API}/monitorias/{mid}/atendimentos/horarios-livres'
                           f'?de={de}&ate={ate}&monitorParticipanteId={vinculo}', alu)
verificar('rota responde no caminho que o frontend usa', st == 200, f'({st})')
horarios = (livres or {}).get('horarios', [])
verificar('devolve slots dentro da disponibilidade', len(horarios) > 0, f'({len(horarios)} slots)')
verificar('resposta traz o sinalizador `truncado`', 'truncado' in (livres or {}))

if horarios:
    primeiro = horarios[0]
    verificar('slot tem os 4 campos que a UI consome',
              all(c in primeiro for c in ('inicio', 'fim', 'monitorParticipanteId', 'nomeMonitor')))
    dur = (datetime.fromisoformat(primeiro['fim'].replace('Z', '+00:00'))
           - datetime.fromisoformat(primeiro['inicio'].replace('Z', '+00:00'))).total_seconds() / 60
    verificar('slot usa a duracao padrao quando nao e informada', dur == PADRAO, f'({dur:.0f} min)')
    verificar('slot e do monitor pedido', primeiro['monitorParticipanteId'] == vinculo)

# Duracao explicita muda o tamanho do slot — e o que os botoes de duracao fazem.
st, livres90 = chamar('GET', f'{API}/monitorias/{mid}/atendimentos/horarios-livres'
                             f'?de={de}&ate={ate}&duracaoMinutos=90'
                             f'&monitorParticipanteId={vinculo}', alu)
if livres90 and livres90.get('horavalues' if False else 'horarios'):
    h = livres90['horarios'][0]
    dur90 = (datetime.fromisoformat(h['fim'].replace('Z', '+00:00'))
             - datetime.fromisoformat(h['inicio'].replace('Z', '+00:00'))).total_seconds() / 60
    verificar('duracaoMinutos=90 devolve slots de 90 min', dur90 == 90, f'({dur90:.0f} min)')

st, _ = chamar('GET', f'{API}/monitorias/{mid}/atendimentos/horarios-livres'
                      f'?de={de}&ate={(agora_local + timedelta(days=90)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")}',
               alu)
verificar('janela acima de 60 dias e recusada com 400', st == 400, f'({st})')

# ------------------------------------------------------------------------ A2

print('\n== A2: serie recorrente, com sucesso parcial ==')
# Ocupa deliberadamente a 2a semana, para que o lote tenha exatamente 1 recusa.
semana2 = dia_alvo + timedelta(days=7)
st, bloqueio = chamar('POST', f'{API}/monitorias/{mid}/atendimentos', alu,
                      {'inicio': instante(semana2, 10), 'fim': instante(semana2, 11),
                       'assunto': 'Sessao que bloqueia a serie', 'modalidade': 'PRESENCIAL',
                       'vagas': 1})
verificar('cria conflito proposital na 2a semana', st == 201, f'({st})')

ocorrencias = [{'inicio': instante(dia_alvo + timedelta(days=7 * k), 10),
                'fim': instante(dia_alvo + timedelta(days=7 * k), 11)} for k in range(4)]

st, lote = chamar('POST', f'{API}/monitorias/{mid}/atendimentos/lote', alu,
                  {'assunto': 'Plantao semanal', 'modalidade': 'PRESENCIAL', 'vagas': 5,
                   'ocorrencias': ocorrencias})
verificar('lote devolve 200, nao 201', st == 200, f'({st})')
verificar('sucesso parcial: 3 criadas, 1 recusada',
          lote and lote['criados'] == 3 and lote['recusados'] == 1,
          f"({lote.get('criados')} criadas / {lote.get('recusados')} recusadas)")
verificar('ordem de entrada preservada',
          lote and [r['inicio'] for r in lote['resultados']] == [o['inicio'] for o in ocorrencias])
recusada = [r for r in (lote or {}).get('resultados', []) if not r['criado']]
verificar('a recusada explica o motivo', bool(recusada) and bool(recusada[0].get('erro')),
          f"({recusada[0].get('erro')[:60] if recusada else '-'}…)")
verificar('as criadas trazem atendimentoId',
          all(r.get('atendimentoId') for r in (lote or {}).get('resultados', []) if r['criado']))

st, _ = chamar('POST', f'{API}/monitorias/{mid}/atendimentos/lote', alu,
               {'assunto': 'Serie grande demais', 'modalidade': 'REMOTO',
                'ocorrencias': ocorrencias * 10})
verificar('acima de 30 ocorrencias e recusado com 400', st == 400, f'({st})')

# ------------------------------------------------------------------------ A4

print('\n== A4: filtros derivados ==')
st, agenda = chamar('GET', f'{API}/atendimentos/meus?aguardandoRegistro=true', alu)
verificar('aguardandoRegistro aceito em /atendimentos/meus', st == 200, f'({st})')

st, _ = chamar('GET', f'{API}/monitorias/{mid}/atendimentos?aguardandoRegistro=true', alu)
verificar('aguardandoRegistro recusado na rota da monitoria (400)', st == 400, f'({st})')

st, pend = chamar('GET', f'{API}/atendimentos/meus?pendentesDeAvaliacao=true', alu)
verificar('pendentesDeAvaliacao aceito em /atendimentos/meus', st == 200, f'({st})')

st, _ = chamar('GET', f'{API}/atendimentos/meus?aguardandoRegistro=true&pendentesDeAvaliacao=true',
               alu)
verificar('os dois juntos sao recusados com 400', st == 400, f'({st})')

# A fila so prova alguma coisa se o recorte for exercitado de verdade: uma
# sessao AGENDADA cujo inicio ja passou. O backend (corretamente) recusa agendar
# no passado, entao o caminho e agendar para daqui a um minuto e esperar.
hoje = agora_local.replace(tzinfo=None)
chamar('POST', f'{API}/monitorias/{mid}/disponibilidades', alu,
       {'diaSemana': hoje.weekday() + 1 if hoje.weekday() < 6 else 0,
        'horaInicio': '00:00', 'horaFim': '23:59'})

daqui_a_pouco = agora_local + timedelta(minutes=1)
st, passado = chamar('POST', f'{API}/monitorias/{mid}/atendimentos', alu,
                     {'inicio': daqui_a_pouco.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z'),
                      'fim': (daqui_a_pouco + timedelta(minutes=30)).astimezone(timezone.utc)
                             .isoformat().replace('+00:00', 'Z'),
                      'assunto': 'Sessao que vai comecar', 'modalidade': 'PRESENCIAL', 'vagas': 3})

if passado and passado.get('id'):
    print('  ...   aguardando 70s para a sessao comecar')
    time.sleep(70)
    st, fila = chamar('GET', f'{API}/atendimentos/meus?aguardandoRegistro=true', alu)
    ids = [a['id'] for a in (fila or {}).get('dados', [])]
    verificar('sessao ja iniciada e AGENDADA aparece na fila de registro', passado['id'] in ids,
              f'({len(ids)} na fila)')

    st, fila_prof = chamar('GET', f'{API}/atendimentos/meus?aguardandoRegistro=true', prof)
    verificar('professor puro nao tem fila (sem vinculo, sem agenda)',
              st == 200 and len(fila_prof['dados']) == 0, f"({len(fila_prof['dados'])})")
else:
    print(f'  FALHA nao foi possivel criar a sessao da fila ({st})')

# ------------------------------------------------------------------------ A3

print('\n== A3: promover a monitor ==')
st, novo = chamar('POST', API + '/alunos', prof,
                  {'nome': f'Monitorado Promovido {sufixo}', 'email': f'prom{sufixo}@ufx.edu.br',
                   'matricula': f'PR{sufixo}', 'curso': 'Engenharia'})
verificar('cria aluno para promover', st == 201, f'({st})')

if novo and novo.get('id'):
    st, vinculado = chamar('POST', f'{API}/monitorias/{mid}/monitorados', prof,
                           {'alunoId': novo['id']})
    verificar('inscreve como MONITORADO', st == 201 and vinculado['papel'] == 'MONITORADO')

    st, promovido = chamar(
        'POST', f'{API}/monitorias/{mid}/participantes/{vinculado["id"]}/promover-a-monitor', prof)
    verificar('promocao responde 200', st == 200, f'({st})')
    verificar('papel novo e MONITOR e esta ATIVO',
              promovido and promovido['papel'] == 'MONITOR'
              and promovido['status'] == 'ATIVO',
              f"({promovido.get('papel')}/{promovido.get('status')})")
    verificar('o vinculo novo tem outro id (o antigo virou historico)',
              promovido['id'] != vinculado['id'])

    st, historico = chamar('GET', f'{API}/monitorias/{mid}/participantes?status=ENCERRADO', prof)
    encerrados = [p['id'] for p in (historico or {}).get('dados', [])]
    verificar('vinculo de monitorado preservado como ENCERRADO (RN10)',
              vinculado['id'] in encerrados)

    st, repetida = chamar(
        'POST', f'{API}/monitorias/{mid}/participantes/{promovido["id"]}/promover-a-monitor', prof)
    verificar('promover quem ja e MONITOR e recusado com 409', st == 409, f'({st})')

    st, pelaAluna = chamar(
        'POST', f'{API}/monitorias/{mid}/participantes/{promovido["id"]}/promover-a-monitor', alu)
    verificar('so o professor responsavel promove (RN01)', st == 403, f'({st})')

# ------------------------------------------------------------------------ B2

print('\n== B2: regras de pontuacao ==')
st, regras = chamar('GET', API + '/gamificacao/regras', alu)
verificar('rota responde', st == 200, f'({st})')
lista = (regras or {}).get('regras', [])
verificar('traz os tres tipos', len(lista) == 3, f'({len(lista)})')
porTipo = {r['tipo']: r for r in lista}
verificar('ATENDIMENTO_REALIZADO tem valor fixo',
          isinstance(porTipo.get('ATENDIMENTO_REALIZADO', {}).get('pontos'), int),
          f"({porTipo.get('ATENDIMENTO_REALIZADO', {}).get('pontos')})")
verificar('AVALIACAO_RECEBIDA vem com pontos=null (variavel, nao zero)',
          porTipo.get('AVALIACAO_RECEBIDA', {}).get('pontos') is None,
          f"({porTipo.get('AVALIACAO_RECEBIDA', {}).get('pontos')})")
verificar('toda regra tem descricao', all(r.get('descricao') for r in lista))

semSessao, _ = chamar('GET', API + '/gamificacao/regras')
verificar('regras exigem autenticacao', semSessao in (401, 403), f'({semSessao})')

# ---------------------------------------------------------------------------

print(f'\n{"=" * 60}')
print(f'{ok} verificacoes OK, {len(falhas)} falhas')
for f in falhas:
    print(f'  - {f}')
print('=' * 60)
