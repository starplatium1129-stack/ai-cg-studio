$SRC = "E:\code\2\lora\AI-CG-Studio"
$DST = "C:\Program Files\AI-CG-Studio\gateway"

Write-Host "Syncing assets, data, dist to installed gateway..."
robocopy "$SRC\assets" "$DST\assets" /MIR /NFL /NDL /NJH /NJS /nc /ns /np
robocopy "$SRC\data" "$DST\data" /MIR /NFL /NDL /NJH /NJS /nc /ns /np
robocopy "$SRC\dist" "$DST\dist" /MIR /NFL /NDL /NJH /NJS /nc /ns /np

Write-Host "Full sync finished!"
