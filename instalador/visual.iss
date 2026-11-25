; Visual nativo do instalador; imagens em 2x e controles com suporte a teclado.
[Code]
var
  Fundo, Progresso: TBitmapImage;
  Primario, Cancelar: TBitmapButton;
  Atalho, Abrir: TNewCheckBox;
  Rodape: TNewStaticText;
  LarguraOriginal, AlturaOriginal, PaginaAtual, Percentual, EtapaAtual: Integer;
  UltimoPercentual: Integer;

function Rect(L, T, R, B: Integer): TRect;
begin
  Result.Left := L; Result.Top := T; Result.Right := R; Result.Bottom := B;
end;

procedure AtualizarProgresso;
var C: TCanvas; I, Y, W: Integer; Nome, Estado: String;
begin
  if Progresso = nil then exit;
  W := ScaleX(436);
  Progresso.Bitmap.Width := W;
  Progresso.Bitmap.Height := ScaleY(172);
  C := Progresso.Bitmap.Canvas;
  C.Brush.Color := $00121210;
  C.FillRect(Rect(0, 0, W, ScaleY(172)));
  C.Font.Name := 'Segoe UI'; C.Font.Size := 22; C.Font.Style := [fsBold];
  C.Font.Color := $0012FFA3;
  C.TextOut(W - ScaleX(80), 0, IntToStr(Percentual) + '%');
  C.Brush.Color := $0026302A;
  C.FillRect(Rect(0, ScaleY(38), W, ScaleY(44)));
  C.Brush.Color := $0012FFA3;
  C.FillRect(Rect(0, ScaleY(38), (W * Percentual) div 100, ScaleY(44)));
  for I := 0 to 3 do begin
    case I of
      0: Nome := 'Aplicativo e interface';
      1: Nome := 'Ferramentas de vídeo';
      2: Nome := 'Modelos de transcrição';
      3: Nome := 'Atalhos e finalização';
    end;
    if I < EtapaAtual then Estado := 'Concluído'
    else if I = EtapaAtual then Estado := 'Instalando'
    else Estado := 'A seguir';
    Y := ScaleY(61 + I * 27);
    C.Brush.Color := $00121210; C.Font.Size := 10; C.Font.Style := [];
    if I <= EtapaAtual then C.Font.Color := $0012FFA3 else C.Font.Color := $0075897D;
    C.TextOut(0, Y, Nome);
    C.Font.Size := 8;
    C.TextOut(W - ScaleX(75), Y + ScaleY(2), Estado);
  end;
  Progresso.Repaint;
end;

procedure Etapa(Numero: Integer);
begin
  if Numero <> EtapaAtual then begin EtapaAtual := Numero; AtualizarProgresso; end;
end;

function QuerAtalho: Boolean;
begin
  Result := True;
  if Atalho <> nil then Result := Atalho.Checked;
end;

procedure AcaoPrimaria(Sender: TObject);
begin
  if WizardForm.NextButton.Enabled then WizardForm.NextButton.OnClick(WizardForm.NextButton);
end;

procedure AcaoCancelar(Sender: TObject);
begin
  if WizardForm.CancelButton.Enabled then WizardForm.CancelButton.OnClick(WizardForm.CancelButton);
end;

procedure Tecla(Sender: TObject; var Key: Word; Shift: TShiftState);
begin
  if (Key = 13) and Primario.Visible then begin Key := 0; AcaoPrimaria(Sender); end;
  if (Key = 27) and Cancelar.Visible then begin Key := 0; AcaoCancelar(Sender); end;
end;

procedure InitializeWizard;
begin
  if WizardSilent then exit;
  LarguraOriginal := WizardForm.ClientWidth; AlturaOriginal := WizardForm.ClientHeight;
  Percentual := 0; EtapaAtual := -1; UltimoPercentual := -1;
  ExtractTemporaryFile('tela-boas-vindas.bmp');
  ExtractTemporaryFile('tela-instalando.bmp');
  ExtractTemporaryFile('tela-concluido.bmp');
  ExtractTemporaryFile('botao-instalar.bmp');
  ExtractTemporaryFile('botao-concluir.bmp');
  ExtractTemporaryFile('botao-cancelar.bmp');
  Fundo := TBitmapImage.Create(WizardForm); Fundo.Parent := WizardForm; Fundo.Stretch := True;
  Progresso := TBitmapImage.Create(WizardForm); Progresso.Parent := WizardForm;
  Primario := TBitmapButton.Create(WizardForm); Primario.Parent := WizardForm;
  Primario.Stretch := True; Primario.BackColor := $00121210; Primario.OnClick := @AcaoPrimaria; Primario.TabStop := True;
  Cancelar := TBitmapButton.Create(WizardForm); Cancelar.Parent := WizardForm;
  Cancelar.Stretch := True; Cancelar.BackColor := $00121210; Cancelar.Caption := 'Cancelar';
  Cancelar.Bitmap.LoadFromFile(ExpandConstant('{tmp}\botao-cancelar.bmp')); Cancelar.OnClick := @AcaoCancelar; Cancelar.TabStop := True;
  Atalho := TNewCheckBox.Create(WizardForm); Atalho.Parent := WizardForm; Atalho.Checked := True;
  Atalho.Caption := 'Criar atalho na área de trabalho';
  Abrir := TNewCheckBox.Create(WizardForm); Abrir.Parent := WizardForm; Abrir.Checked := True;
  Abrir.Caption := 'Abrir o Estúdio Criativo Cortes';
  Rodape := TNewStaticText.Create(WizardForm); Rodape.Parent := WizardForm;
  Rodape.AutoSize := False; Rodape.Alignment := taRightJustify; Rodape.Font.Size := 8;
  WizardForm.KeyPreview := True; WizardForm.OnKeyDown := @Tecla;
end;

procedure CurPageChanged(CurPageID: Integer);
var Personalizada: Boolean; Tela: String;
begin
  if WizardSilent then exit;
  PaginaAtual := CurPageID;
  Personalizada := (CurPageID = wpWelcome) or (CurPageID = wpInstalling) or (CurPageID = wpFinished);
  Fundo.Visible := Personalizada; Primario.Visible := Personalizada and (CurPageID <> wpInstalling);
  Cancelar.Visible := Personalizada and (CurPageID <> wpFinished);
  Atalho.Visible := CurPageID = wpWelcome; Abrir.Visible := CurPageID = wpFinished;
  Rodape.Visible := Personalizada; Progresso.Visible := CurPageID = wpInstalling;
  WizardForm.OuterNotebook.Visible := not Personalizada;
  WizardForm.MainPanel.Visible := not Personalizada;
  WizardForm.Bevel.Visible := not Personalizada;
  WizardForm.BackButton.Visible := not Personalizada;
  WizardForm.NextButton.Visible := not Personalizada;
  WizardForm.CancelButton.Visible := not Personalizada;
  if not Personalizada then begin
    WizardForm.ClientWidth := LarguraOriginal; WizardForm.ClientHeight := AlturaOriginal;
    exit;
  end;
  WizardForm.ClientWidth := ScaleX(500); WizardForm.ClientHeight := ScaleY(660);
  Fundo.SetBounds(0, 0, ScaleX(500), ScaleY(570));
  Progresso.SetBounds(ScaleX(32), ScaleY(269), ScaleX(436), ScaleY(172));
  Primario.SetBounds(ScaleX(288), ScaleY(589), ScaleX(180), ScaleY(44));
  Cancelar.SetBounds(ScaleX(118), ScaleY(589), ScaleX(150), ScaleY(44));
  Atalho.SetBounds(ScaleX(32), ScaleY(537), ScaleX(436), ScaleY(24));
  Abrir.SetBounds(ScaleX(32), ScaleY(537), ScaleX(436), ScaleY(24));
  Rodape.SetBounds(ScaleX(32), ScaleY(639), ScaleX(436), ScaleY(18));
  if CurPageID = wpWelcome then begin
    Tela := 'boas-vindas'; Primario.Caption := 'Instalar agora';
    Primario.Bitmap.LoadFromFile(ExpandConstant('{tmp}\botao-instalar.bmp'));
    Rodape.Caption := 'Tudo pronto para começar.  •  @erichpereira22';
  end else if CurPageID = wpInstalling then begin
    Tela := 'instalando'; Rodape.Caption := 'Mantenha esta janela aberta.';
    Cancelar.Left := ScaleX(318); AtualizarProgresso;
  end else begin
    Tela := 'concluido'; Primario.Caption := 'Começar a criar';
    Primario.Bitmap.LoadFromFile(ExpandConstant('{tmp}\botao-concluir.bmp'));
    Rodape.Caption := 'Disponível também no menu Iniciar.';
  end;
  Fundo.Bitmap.LoadFromFile(ExpandConstant('{tmp}\tela-' + Tela + '.bmp'));
  if Primario.Visible then WizardForm.ActiveControl := Primario;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  if WizardSilent then begin Result := True; exit; end;
  if (CurPageID = wpFinished) and (WizardForm.RunList.Items.Count > 0) then
    WizardForm.RunList.Checked[0] := Abrir.Checked;
  Result := True;
end;

procedure CurInstallProgressChanged(CurProgress, MaxProgress: Integer);
begin
  if MaxProgress > 0 then Percentual := Round((CurProgress * 100.0) / MaxProgress);
  if Percentual <> UltimoPercentual then begin
    UltimoPercentual := Percentual; AtualizarProgresso;
  end;
end;
