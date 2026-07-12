param(
  [Parameter(Mandatory = $true)][string]$InputDirectory,
  [Parameter(Mandatory = $true)][string]$OutputFile
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ColumnIndex([string]$cellRef) {
  $letters = $cellRef -replace '[^A-Z]', ''
  $index = 0
  foreach ($ch in $letters.ToCharArray()) {
    $index = ($index * 26) + ([int]$ch - [int][char]'A' + 1)
  }
  return $index - 1
}

function Read-EntryText($zip, [string]$path) {
  $entry = $zip.GetEntry($path)
  if (-not $entry) { return $null }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

$result = [ordered]@{}

Get-ChildItem -LiteralPath $InputDirectory -Filter '*.xlsx' | Sort-Object Name | ForEach-Object {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($_.FullName)
  try {
    $shared = @()
    $sharedXmlText = Read-EntryText $zip 'xl/sharedStrings.xml'
    if ($sharedXmlText) {
      [xml]$sharedXml = $sharedXmlText
      foreach ($item in $sharedXml.sst.si) {
        if ($item.t -is [string]) { $shared += $item.t }
        elseif ($item.t) { $shared += $item.t.'#text' }
        elseif ($item.r) { $shared += (($item.r | ForEach-Object { $_.t.'#text' }) -join '') }
        else { $shared += '' }
      }
    }

    [xml]$workbook = Read-EntryText $zip 'xl/workbook.xml'
    [xml]$rels = Read-EntryText $zip 'xl/_rels/workbook.xml.rels'
    $relationshipMap = @{}
    foreach ($rel in $rels.Relationships.Relationship) { $relationshipMap[$rel.Id] = $rel.Target }

    $book = [ordered]@{}
    foreach ($sheet in $workbook.workbook.sheets.sheet) {
      $rid = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
      $target = $relationshipMap[$rid] -replace '^/', ''
      if (-not $target.StartsWith('xl/')) { $target = 'xl/' + $target.TrimStart('/') }
      [xml]$sheetXml = Read-EntryText $zip $target
      $rows = @()
      foreach ($row in $sheetXml.worksheet.sheetData.row) {
        $values = @{}
        $maxIndex = -1
        foreach ($cell in $row.c) {
          $index = Get-ColumnIndex $cell.r
          if ($index -gt $maxIndex) { $maxIndex = $index }
          $value = $null
          if ($cell.t -eq 's') { $value = $shared[[int]$cell.v] }
          elseif ($cell.t -eq 'inlineStr') {
            if ($cell.is.t) { $value = [string]$cell.is.t }
            elseif ($cell.is.r) { $value = (($cell.is.r | ForEach-Object { [string]$_.t }) -join '') }
          }
          elseif ($cell.t -eq 'b') { $value = ([string]$cell.v -eq '1') }
          elseif ($null -ne $cell.v) {
            $raw = [string]$cell.v
            $number = 0.0
            if ([double]::TryParse($raw, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) { $value = $number }
            else { $value = $raw }
          }
          else { $value = '' }
          $values[$index] = $value
        }
        if ($maxIndex -ge 0) {
          $items = for ($i = 0; $i -le $maxIndex; $i++) { if ($values.ContainsKey($i)) { $values[$i] } else { $null } }
          $rows += ,$items
        }
      }
      $book[[string]$sheet.name] = $rows
    }
    $result[$_.BaseName] = $book
  }
  finally { $zip.Dispose() }
}

$json = $result | ConvertTo-Json -Depth 20 -Compress
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $OutputFile), $json, [System.Text.UTF8Encoding]::new($false))
