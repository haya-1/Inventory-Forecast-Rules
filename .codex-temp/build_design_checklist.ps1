param(
  [string]$DataPath = ".codex-temp\design_checklist_data.tsv",
  [string]$OutputPath = "outputs\019e49d0-8e2d-7402-ae5c-c595a9ac4fb9\design-review-checklist.xlsx"
)

$ErrorActionPreference = "Stop"

function Escape-XmlText {
  param([AllowNull()][string]$Text)
  if ($null -eq $Text) { return "" }
  return [System.Security.SecurityElement]::Escape($Text)
}

function CellRef {
  param([int]$Col, [int]$Row)
  $letters = ""
  $n = $Col
  while ($n -gt 0) {
    $r = ($n - 1) % 26
    $letters = [char](65 + $r) + $letters
    $n = [math]::Floor(($n - 1) / 26)
  }
  return "$letters$Row"
}

function InlineCell {
  param(
    [int]$Col,
    [int]$Row,
    [AllowNull()][string]$Value,
    [int]$Style = 0
  )
  $ref = CellRef $Col $Row
  $style = if ($Style -gt 0) { " s=`"$Style`"" } else { "" }
  $escaped = Escape-XmlText $Value
  return "<c r=`"$ref`" t=`"inlineStr`"$style><is><t>$escaped</t></is></c>"
}

function Build-Row {
  param(
    [int]$RowIndex,
    [object[]]$Values,
    [int]$Style = 0,
    [double]$Height = 21
  )
  $cells = for ($i = 0; $i -lt $Values.Count; $i++) {
    InlineCell -Col ($i + 1) -Row $RowIndex -Value ([string]$Values[$i]) -Style $Style
  }
  return "<row r=`"$RowIndex`" ht=`"$Height`" customHeight=`"1`">$($cells -join '')</row>"
}

$lines = Get-Content -LiteralPath $DataPath -Encoding UTF8
if ($lines.Count -lt 2) {
  throw "Data file is empty."
}

$headers = $lines[0] -split "`t", -1
$rows = @()
for ($i = 1; $i -lt $lines.Count; $i++) {
  if ([string]::IsNullOrWhiteSpace($lines[$i])) { continue }
  $rows += ,($lines[$i] -split "`t", -1)
}

$title = "&#22791;&#36135;&#35268;&#21017;&#37197;&#32622;&#39029;&#38754;&#35774;&#35745;&#25913;&#21160;&#23457;&#26597;&#28165;&#21333;"
$instruction = "&#35831;&#22312;&#12300;&#21246;&#36873;&#12301;&#21015;&#36873;&#25321; &#9745;&#65292;&#22312;&#12300;&#26159;&#21542;&#37319;&#32435;&#12301;&#21015;&#36873;&#25321;&#22788;&#29702;&#32467;&#35770;&#65292;&#24182;&#22312;&#12300;&#22791;&#27880;&#12301;&#21015;&#34917;&#20805;&#35843;&#25972;&#24847;&#35265;&#12290;"

$outFullPath = Join-Path (Get-Location) $OutputPath
$outDir = Split-Path -Parent $outFullPath
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("design_checklist_xlsx_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

try {
  New-Item -ItemType Directory -Force -Path (Join-Path $tempDir "_rels") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $tempDir "docProps") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $tempDir "xl") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $tempDir "xl\_rels") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $tempDir "xl\worksheets") | Out-Null

  $sheetRows = New-Object System.Collections.Generic.List[string]
  $sheetRows.Add("<row r=`"1`" ht=`"30`" customHeight=`"1`"><c r=`"A1`" t=`"inlineStr`" s=`"1`"><is><t>$title</t></is></c></row>")
  $sheetRows.Add("<row r=`"2`" ht=`"22`" customHeight=`"1`"><c r=`"A2`" t=`"inlineStr`" s=`"2`"><is><t>$instruction</t></is></c></row>")
  $sheetRows.Add("<row r=`"3`" ht=`"8`" customHeight=`"1`"></row>")
  $sheetRows.Add((Build-Row -RowIndex 4 -Values $headers -Style 3 -Height 24))

  $rowIndex = 5
  foreach ($item in $rows) {
    $style = 4
    if ($item[1] -like "D*") { $style = 5 }
    elseif ($item[1] -like "O*") { $style = 6 }
    $sheetRows.Add((Build-Row -RowIndex $rowIndex -Values $item -Style $style -Height 35))
    $rowIndex++
  }

  $lastRow = $rowIndex - 1
  $worksheetXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:H$lastRow"/>
  <sheetViews>
    <sheetView workbookViewId="0" showGridLines="0">
      <pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A5" sqref="A5"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="9" customWidth="1"/>
    <col min="2" max="2" width="9" customWidth="1"/>
    <col min="3" max="3" width="16" customWidth="1"/>
    <col min="4" max="4" width="13" customWidth="1"/>
    <col min="5" max="5" width="38" customWidth="1"/>
    <col min="6" max="6" width="42" customWidth="1"/>
    <col min="7" max="7" width="14" customWidth="1"/>
    <col min="8" max="8" width="34" customWidth="1"/>
  </cols>
  <sheetData>
$($sheetRows -join "`n")
  </sheetData>
  <autoFilter ref="A4:H$lastRow"/>
  <mergeCells count="2">
    <mergeCell ref="A1:H1"/>
    <mergeCell ref="A2:H2"/>
  </mergeCells>
  <dataValidations count="2">
    <dataValidation type="list" allowBlank="1" showDropDown="0" sqref="A5:A$lastRow">
      <formula1>"&#9744;,&#9745;"</formula1>
    </dataValidation>
    <dataValidation type="list" allowBlank="1" showDropDown="0" sqref="G5:G$lastRow">
      <formula1>"&#24453;&#23457;,&#37319;&#32435;,&#19981;&#37319;&#32435;,&#26242;&#32531;,&#24050;&#23436;&#25104;"</formula1>
    </dataValidation>
  </dataValidations>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>
"@

  $stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><name val="Microsoft YaHei"/></font>
    <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font>
    <font><b/><sz val="10"/><color rgb="FF1F2937"/><name val="Microsoft YaHei"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF275317"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD9E2EC"/></left>
      <right style="thin"><color rgb="FFD9E2EC"/></right>
      <top style="thin"><color rgb="FFD9E2EC"/></top>
      <bottom style="thin"><color rgb="FFD9E2EC"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>
"@

  $workbookXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16200"/></bookViews>
  <sheets>
    <sheet name="Review" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
"@

  $contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>
"@

  $relsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

  $workbookRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@

  $now = (Get-Date).ToUniversalTime().ToString("s") + "Z"
  $coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>$title</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$now</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$now</dcterms:modified>
</cp:coreProperties>
"@

  $appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>Review</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company></Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0300</AppVersion>
</Properties>
"@

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Join-Path $tempDir "[Content_Types].xml"), $contentTypesXml, $utf8NoBom)
  [System.IO.File]::WriteAllText((Join-Path $tempDir "_rels\.rels"), $relsXml, $utf8NoBom)
  [System.IO.File]::WriteAllText((Join-Path $tempDir "docProps\core.xml"), $coreXml, $utf8NoBom)
  [System.IO.File]::WriteAllText((Join-Path $tempDir "docProps\app.xml"), $appXml, $utf8NoBom)
  [System.IO.File]::WriteAllText((Join-Path $tempDir "xl\workbook.xml"), $workbookXml, $utf8NoBom)
  [System.IO.File]::WriteAllText((Join-Path $tempDir "xl\styles.xml"), $stylesXml, $utf8NoBom)
  [System.IO.File]::WriteAllText((Join-Path $tempDir "xl\_rels\workbook.xml.rels"), $workbookRelsXml, $utf8NoBom)
  [System.IO.File]::WriteAllText((Join-Path $tempDir "xl\worksheets\sheet1.xml"), $worksheetXml, $utf8NoBom)

  if (Test-Path $outFullPath) { Remove-Item -LiteralPath $outFullPath -Force }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $outFullPath)

  Write-Output $outFullPath
}
finally {
  if (Test-Path $tempDir) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force
  }
}
