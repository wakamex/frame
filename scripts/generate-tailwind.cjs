/**
 * Pre-generates Tailwind CSS v4 by scanning source files for class candidates.
 * Run this before building: node scripts/generate-tailwind.cjs
 *
 * This replaces the @tailwindcss/vite plugin which crashes in electron-vite.
 */
const { compile } = require('tailwindcss')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'app', 'tailwind-generated.css')

async function loadStylesheet(id, base) {
  let filePath
  if (id.startsWith('tailwindcss/')) {
    filePath = require.resolve(id)
  } else if (id === 'tailwindcss') {
    filePath = require.resolve('tailwindcss/index.css')
  } else {
    filePath = path.resolve(base || '.', id)
  }
  const content = fs.readFileSync(filePath, 'utf8')
  return { content, base: path.dirname(filePath) }
}

function scanDir(dir) {
  const candidates = new Set()
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return candidates
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      for (const c of scanDir(fullPath)) candidates.add(c)
    } else if (/\.(tsx?|jsx?|html)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8')

      // Extract from className="..." / className='...' and class="..." / class='...'
      const strMatches = content.matchAll(/(?:className|class)=["']([^"']+)["']/g)
      for (const m of strMatches) {
        for (const cls of m[1].split(/\s+/)) {
          if (cls && !cls.includes('$') && !cls.includes('{')) {
            candidates.add(cls)
          }
        }
      }

      // Extract from template literals: className={`...`}
      const tmplMatches = content.matchAll(/className=\{`([^`]+)`\}/g)
      for (const m of tmplMatches) {
        // Split on whitespace and template expressions ${...}
        const parts = m[1].split(/\$\{[^}]*\}/g).join(' ').split(/\s+/)
        for (const cls of parts) {
          if (cls && !cls.includes('$') && !cls.includes('{') && !cls.includes('}')) {
            candidates.add(cls)
          }
        }
      }

      // Extract from conditional expressions inside template literals
      // e.g., isActive ? 'bg-gray-800 text-gray-100' : 'text-gray-400'
      const condMatches = content.matchAll(/['"]([a-z][\w\-\/.]+(?: [a-z][\w\-\/.]+)*)['"]/g)
      for (const m of condMatches) {
        for (const cls of m[1].split(/\s+/)) {
          // Only add things that look like Tailwind classes
          if (/^[a-z][\w\-]*(?:\/[\w.]+)?$/.test(cls) || /^-?[a-z]/.test(cls)) {
            candidates.add(cls)
          }
        }
      }
    }
  }
  return candidates
}

async function main() {
  const compiler = await compile('@import "tailwindcss";', { loadStylesheet })

  // Scan app/ and resources/ directories
  const candidates = new Set()
  for (const c of scanDir(path.join(ROOT, 'app'))) candidates.add(c)
  for (const c of scanDir(path.join(ROOT, 'resources', 'Components'))) candidates.add(c)

  // Filter out obvious non-classes
  const filtered = [...candidates].filter(c => {
    if (c.length < 2) return false
    if (c.startsWith('//') || c.startsWith('/*')) return false
    if (/^[A-Z]/.test(c)) return false // Component names
    if (c.includes('(') || c.includes(')')) return false
    if (c.includes('=')) return false
    return true
  })

  const css = compiler.build(filtered)
  fs.writeFileSync(OUTPUT, css)
  console.log(`Generated ${css.length} bytes of CSS from ${filtered.length} candidates → ${OUTPUT}`)
}

main().catch(e => {
  console.error('Failed to generate Tailwind CSS:', e)
  process.exit(1)
})
