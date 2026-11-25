# -*- coding: utf-8 -*-
"""Elementos vetoriais e tipografia do instalador. Requer Pillow; sem downloads de arte."""
import os, json
from PIL import Image, ImageDraw, ImageFont
AQUI=os.path.dirname(os.path.abspath(__file__))
SAIDA=os.path.join(AQUI,'imagens')
BG='#101210'; NEON='#a3ff12'; TEXT='#f3f5f0'; MUTED='#a6afa1'
FONT=os.path.join(os.environ.get('WINDIR',r'C:\Windows'),'Fonts')
VERSION=json.load(open(os.path.join(AQUI,'..','package.json'),encoding='utf-8'))['version']
S=2

def font(n,bold=False): return ImageFont.truetype(os.path.join(FONT,'seguisb.ttf' if bold else 'segoeui.ttf'),round(n*S))
def text(d,x,y,t,n=12,color=TEXT,bold=False): d.text((x*S,y*S),t,font=font(n,bold),fill=color,spacing=5*S)
def rect(d,box,color,r=0,outline=None): d.rounded_rectangle(tuple(round(v*S) for v in box),radius=r*S,fill=color,outline=outline,width=S)
def icon(size):
    im=Image.new('RGBA',(size,size));d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,size-1,size-1),radius=size*.25,fill='#17230e')
    pts=lambda a:[(round(x*size),round(y*size)) for x,y in a]
    d.line(pts([(.23,.35),(.23,.23),(.42,.23)]),fill=NEON,width=max(1,round(size*.055)))
    d.line(pts([(.77,.65),(.77,.77),(.58,.77)]),fill=NEON,width=max(1,round(size*.055)))
    d.polygon(pts([(.39,.33),(.7,.5),(.39,.67)]),fill=NEON)
    return im

def page(kind):
    im=Image.new('RGB',(500*S,570*S),BG);d=ImageDraw.Draw(im)
    im.paste(icon(44*S),(32*S,28*S),icon(44*S))
    text(d,88,29,'Estúdio Criativo Cortes',14,bold=True)
    text(d,88,51,'Seu conteúdo. Sua identidade.',10,MUTED)
    rect(d,(412,35,468,57),'#182112',11,'#364528');text(d,422,39,'v'+VERSION,9,'#b6dc8c')
    if kind=='boas-vindas':
        text(d,32,100,'Seu próximo corte\ncomeça aqui.',30,bold=True)
        text(d,32,190,'Transforme vídeos e lives em conteúdo\ncom a sua identidade.',13,MUTED)
        features=[('Cortes de vídeos e lives','Seu conteúdo, pronto para compartilhar.'),('Vinheta e marca d’água','Sua assinatura em cada corte.'),('Processamento no seu PC','Ferramentas e modelos incluídos.')]
        for i,(title,sub) in enumerate(features):
            y=269+i*62;rect(d,(32,y,68,y+36),'#1c2516',9,'#303c22');text(d,44,y+6,str(i+1),15,NEON,True)
            text(d,82,y+1,title,13,bold=True);text(d,82,y+23,sub,10,MUTED)
        rect(d,(32,463,468,464),'#292f25');text(d,32,479,'INSTALAÇÃO PARA SEU USUÁRIO',9,'#829078')
        text(d,32,499,'AppData / Local / Programs / EstudioCriativoCortes',10,MUTED)
    elif kind=='instalando':
        text(d,32,100,'Preparando seu\nespaço criativo.',30,bold=True)
        text(d,32,190,'Estamos instalando as ferramentas\npara você criar seus próximos cortes.',13,MUTED)
        text(d,32,261,'Instalando os componentes',12)
        rect(d,(32,464,468,546),'#192115',12,'#303e23')
        text(d,48,479,'DO VÍDEO AO CORTE',9,'#acd87b')
        text(d,48,501,'Escolha um vídeo e personalize sua vinheta\ne marca d’água depois da instalação.',11,MUTED)
    else:
        text(d,32,100,'Tudo pronto.\nAgora é criar.',30,bold=True)
        text(d,32,190,'Seu próximo conteúdo já pode ganhar forma.\nAbra pelo atalho ou pelo menu Iniciar.',13,MUTED)
        rect(d,(32,264,468,416),'#192315',14,'#314424')
        d.ellipse((227*S,282*S,273*S,328*S),fill=NEON);text(d,239,284,'✓',26,'#162400')
        text(d,163,345,'Instalação concluída',16,bold=True);text(d,165,374,'Ferramentas prontas para usar.',11,MUTED)
        text(d,32,444,'SEU PRIMEIRO CORTE',9,'#829078')
        text(d,32,467,'Escolha um vídeo e deixe a criatividade\nentrar em cena.',12,MUTED)
    im.save(os.path.join(SAIDA,'tela-'+kind+'.bmp'))

def button(name,label,primary):
    im=Image.new('RGB',(180*S,44*S),BG);d=ImageDraw.Draw(im)
    rect(d,(1,1,179,43),NEON if primary else '#1a1f17',21,None if primary else '#3a4234')
    box=d.textbbox((0,0),label,font=font(12,True));x=(180*S-(box[2]-box[0]))/2
    d.text((x,12*S),label,font=font(12,True),fill='#122000' if primary else '#d9dfd4')
    im.save(os.path.join(SAIDA,'botao-'+name+'.bmp'))

def main():
    os.makedirs(SAIDA,exist_ok=True)
    ic=icon(512);ic.resize((256,256)).save(os.path.join(SAIDA,'icone-256.png'))
    ic.save(os.path.join(SAIDA,'icone.ico'),sizes=[(s,s) for s in (16,24,32,48,64,128,256)])
    for k in ['boas-vindas','instalando','concluido']:page(k)
    for n,label,p in [('instalar','Instalar agora →',True),('concluir','Começar a criar →',True),('cancelar','Cancelar',False)]:button(n,label,p)
    for i,(w,h) in enumerate([(164,314),(246,459),(410,797)]):
        im=Image.new('RGB',(w,h),BG);a=icon(int(w*.65));im.paste(a,((w-a.width)//2,(h-a.height)//2),a);im.save(os.path.join(SAIDA,'lateral-%d.bmp'%i))
    for i,t in enumerate([55,83,138]):
        im=Image.new('RGB',(t,t),BG);a=icon(int(t*.85));im.paste(a,((t-a.width)//2,(t-a.height)//2),a);im.save(os.path.join(SAIDA,'pequena-%d.bmp'%i))
    print('Identidade visual gerada:',VERSION)
if __name__=='__main__':main()
