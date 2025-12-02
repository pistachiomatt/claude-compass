module.exports = {
  apps: [
    {
      name: 'nextjs',
      script: 'next',
      args: 'start',
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT || 80,
        FORCE_COLOR: '1',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      error_file: '/dev/null',
      out_file: '/dev/null',
      log_file: '/dev/null',
    },
    // The current proto doesn't use jobs; but keeping this
    // for future async tasks like overnight research
    // {
    //   name: 'worker',
    //   script: './.next/server/worker.js',
    //   node_args: ['--experimental-wasm-stack-switching'],
    //   env: {
    //     NODE_ENV: process.env.NODE_ENV,
    //     FORCE_COLOR: '1',
    //   },
    //   instances: 1,
    //   exec_mode: 'fork',
    //   max_memory_restart: '1024M',
    //   error_file: '/dev/null',
    //   out_file: '/dev/null',
    //   log_file: '/dev/null',
    //   restart_delay: 5000,
    // }
  ],
}
