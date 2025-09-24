const [exampleName = 'basic', ...passThrough] = Deno.args

const cwd = `${Deno.cwd()}/examples/${exampleName}`

try {
  const stat = await Deno.stat(cwd)
  if (!stat.isDirectory) {
    console.error(`Example directory is not a folder: ${cwd}`)
    Deno.exit(1)
  }
} catch (error) {
  if (error instanceof Deno.errors.NotFound) {
    console.error(`Unknown example: ${exampleName}`)
    Deno.exit(1)
  }
  throw error
}

const command = new Deno.Command('deno', {
  cwd,
  args: ['run', '-A', 'npm:vite', 'dev', ...passThrough],
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})

const child = command.spawn()
const { code, signal } = await child.status

if (signal) {
  Deno.exit(128 + signal)
}

Deno.exit(code)
