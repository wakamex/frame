#!/usr/bin/env bash
# Compare lines of code between /code/frame and /code/frame-modernized
# Groups files by category and shows totals

set -euo pipefail

OLD="/code/frame"
NEW="/code/frame-modernized"

count_loc() {
  local dir="$1"
  local pattern="$2"
  find "$dir" -path '*/node_modules' -prune -o \
               -path '*/.git' -prune -o \
               -path '*/compiled' -prune -o \
               -path '*/bundle' -prune -o \
               -path '*/dist' -prune -o \
               -path '*/.parcel-cache' -prune -o \
               -name "$pattern" -print 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'
}

count_loc_multi() {
  local dir="$1"
  shift
  local total=0
  for pattern in "$@"; do
    local n
    n=$(count_loc "$dir" "$pattern")
    total=$((total + ${n:-0}))
  done
  echo "$total"
}

count_files() {
  local dir="$1"
  local pattern="$2"
  find "$dir" -path '*/node_modules' -prune -o \
               -path '*/.git' -prune -o \
               -path '*/compiled' -prune -o \
               -path '*/bundle' -prune -o \
               -path '*/dist' -prune -o \
               -path '*/.parcel-cache' -prune -o \
               -name "$pattern" -print 2>/dev/null | wc -l
}

count_files_multi() {
  local dir="$1"
  shift
  local total=0
  for pattern in "$@"; do
    local n
    n=$(count_files "$dir" "$pattern")
    total=$((total + ${n:-0}))
  done
  echo "$total"
}

# Category-specific counts
count_category() {
  local dir="$1"
  local subdir="$2"
  local full="$dir/$subdir"
  [ -d "$full" ] || { echo "0"; return; }
  find "$full" -path '*/node_modules' -prune -o \
               -path '*/.git' -prune -o \
               -path '*/compiled' -prune -o \
               -path '*/bundle' -prune -o \
               \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.styl' -o -name '*.css' \) -print 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'
}

count_category_files() {
  local dir="$1"
  local subdir="$2"
  local full="$dir/$subdir"
  [ -d "$full" ] || { echo "0"; return; }
  find "$full" -path '*/node_modules' -prune -o \
               -path '*/.git' -prune -o \
               -path '*/compiled' -prune -o \
               -path '*/bundle' -prune -o \
               \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.styl' -o -name '*.css' \) -print 2>/dev/null | wc -l
}

printf "%-35s %8s %6s  %8s %6s  %8s\n" "CATEGORY" "OLD LOC" "FILES" "NEW LOC" "FILES" "CHANGE"
printf "%-35s %8s %6s  %8s %6s  %8s\n" "---" "---" "---" "---" "---" "---"

total_old=0
total_new=0

print_row() {
  local label="$1"
  local old_loc="$2"
  local old_files="$3"
  local new_loc="$4"
  local new_files="$5"
  local change=$((new_loc - old_loc))
  local sign=""
  [ "$change" -ge 0 ] && sign="+"
  printf "%-35s %8d %6d  %8d %6d  %+8d\n" "$label" "$old_loc" "$old_files" "$new_loc" "$new_files" "$change"
  total_old=$((total_old + old_loc))
  total_new=$((total_new + new_loc))
}

# --- Renderer / Frontend ---
for subdir in "app/tray" "app/dash" "app/dapp" "app/notify" "app/onboard"; do
  label="Frontend: ${subdir#app/}"
  old=$(count_category "$OLD" "$subdir")
  old_f=$(count_category_files "$OLD" "$subdir")
  new=$(count_category "$NEW" "$subdir")
  new_f=$(count_category_files "$NEW" "$subdir")
  [ "$old" -gt 0 ] || [ "$new" -gt 0 ] && print_row "$label" "${old:-0}" "${old_f:-0}" "${new:-0}" "${new_f:-0}"
done

# New app/ (the modernized frontend)
old_app=0; old_app_f=0
new_app=$(count_category "$NEW" "app")
new_app_f=$(count_category_files "$NEW" "app")
# Subtract old sub-apps that were counted above
for subdir in "app/tray" "app/dash" "app/dapp" "app/notify" "app/onboard"; do
  sub=$(count_category "$OLD" "$subdir")
  sub_f=$(count_category_files "$OLD" "$subdir")
  old_app=$((old_app + ${sub:-0}))
  old_app_f=$((old_app_f + ${sub_f:-0}))
done
old_app_root=$(count_category "$OLD" "app")
old_app_new=$((${old_app_root:-0} - old_app))
old_app_new_f=$(($(count_category_files "$OLD" "app") - old_app_f))
print_row "Frontend: new app/" "${old_app_new:-0}" "${old_app_new_f:-0}" "$new_app" "$new_app_f"

# --- Main process ---
print_row "Main process" \
  "$(count_category "$OLD" "main")" "$(count_category_files "$OLD" "main")" \
  "$(count_category "$NEW" "main")" "$(count_category_files "$NEW" "main")"

# --- Resources (shared) ---
print_row "Resources (shared)" \
  "$(count_category "$OLD" "resources")" "$(count_category_files "$OLD" "resources")" \
  "$(count_category "$NEW" "resources")" "$(count_category_files "$NEW" "resources")"

# --- Tests ---
print_row "Tests" \
  "$(count_category "$OLD" "test")" "$(count_category_files "$OLD" "test")" \
  "$(count_category "$NEW" "test")" "$(count_category_files "$NEW" "test")"

# --- Stylus files ---
old_styl=$(count_loc_multi "$OLD" "*.styl")
old_styl_f=$(count_files_multi "$OLD" "*.styl")
new_styl=$(count_loc_multi "$NEW" "*.styl")
new_styl_f=$(count_files_multi "$NEW" "*.styl")
print_row "Stylus (.styl)" "${old_styl:-0}" "${old_styl_f:-0}" "${new_styl:-0}" "${new_styl_f:-0}"

# --- CSS files ---
old_css=$(count_loc_multi "$OLD" "*.css")
old_css_f=$(count_files_multi "$OLD" "*.css")
new_css=$(count_loc_multi "$NEW" "*.css")
new_css_f=$(count_files_multi "$NEW" "*.css")
print_row "CSS (.css)" "${old_css:-0}" "${old_css_f:-0}" "${new_css:-0}" "${new_css_f:-0}"

# --- Config files ---
old_cfg=0; new_cfg=0; old_cfg_f=0; new_cfg_f=0
for f in package.json tsconfig.json jest.config.json .babelrc.json .eslintrc.json eslint.config.mjs; do
  [ -f "$OLD/$f" ] && old_cfg=$((old_cfg + $(wc -l < "$OLD/$f"))) && old_cfg_f=$((old_cfg_f + 1))
  [ -f "$NEW/$f" ] && new_cfg=$((new_cfg + $(wc -l < "$NEW/$f"))) && new_cfg_f=$((new_cfg_f + 1))
done
# Include vite config
[ -f "$NEW/electron.vite.config.ts" ] && new_cfg=$((new_cfg + $(wc -l < "$NEW/electron.vite.config.ts"))) && new_cfg_f=$((new_cfg_f + 1))
print_row "Config files" "$old_cfg" "$old_cfg_f" "$new_cfg" "$new_cfg_f"

# --- Scripts ---
print_row "Scripts" \
  "$(count_category "$OLD" "scripts")" "$(count_category_files "$OLD" "scripts")" \
  "$(count_category "$NEW" "scripts")" "$(count_category_files "$NEW" "scripts")"

printf "%-35s %8s %6s  %8s %6s  %8s\n" "---" "---" "---" "---" "---" "---"

# Grand total (all source files)
grand_old=0; grand_new=0; grand_old_f=0; grand_new_f=0
for ext in "*.ts" "*.tsx" "*.js" "*.jsx" "*.styl" "*.css"; do
  n=$(count_loc "$OLD" "$ext"); grand_old=$((grand_old + ${n:-0}))
  n=$(count_loc "$NEW" "$ext"); grand_new=$((grand_new + ${n:-0}))
  n=$(count_files "$OLD" "$ext"); grand_old_f=$((grand_old_f + ${n:-0}))
  n=$(count_files "$NEW" "$ext"); grand_new_f=$((grand_new_f + ${n:-0}))
done

change=$((grand_new - grand_old))
printf "%-35s %8d %6d  %8d %6d  %+8d\n" "GRAND TOTAL" "$grand_old" "$grand_old_f" "$grand_new" "$grand_new_f" "$change"
