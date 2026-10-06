#!/bin/bash
# Create PRF exam subject folders
URL="https://study-vault-six-delta.vercel.app"
COOKIES="/tmp/prf-cookies.txt"
PRF_ID="cmuwv22vq0003js04s51wr0st"

# Subjects for PRF exam (Polícia Rodoviária Federal)
SUBJECTS=(
  "Língua Portuguesa"
  "Matemática"
  "Raciocínio Lógico"
  "Informática"
  "Direito Constitucional"
  "Direito Administrativo"
  "Direito Penal"
  "Direito Processual Penal"
  "Direito Civil"
  "Direitos Humanos"
  "Legislação Especial"
  "Legislação da PRF"
  "Noções de Criminologia"
  "Atualidades"
)

echo "=== Creating ${#SUBJECTS[@]} subject folders under PRF ==="
for SUBJECT in "${SUBJECTS[@]}"; do
  RESP=$(curl -s -b "$COOKIES" -X POST "$URL/api/v1/folders" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$SUBJECT\",\"parentId\":\"$PRF_ID\"}")
  OK=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok', False))" 2>/dev/null)
  PATH_VAL=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('path','?'))" 2>/dev/null)
  if [ "$OK" = "True" ]; then
    echo "  ✓ $SUBJECT → $PATH_VAL"
  else
    echo "  ✗ $SUBJECT → FAILED: $RESP"
  fi
  sleep 0.3
done

echo ""
echo "=== Listing children of PRF ==="
curl -s -b "$COOKIES" "$URL/api/v1/folders?parentId=$PRF_ID" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('data', {}).get('items', [])
print(f'Total subfolders: {len(items)}')
for i in sorted(items, key=lambda x: x['name']):
    print(f'  - {i[\"name\"]}  ({i[\"path\"]})')
"
