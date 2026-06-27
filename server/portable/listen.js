export function listenWithFallback(app, {
  host = '127.0.0.1',
  port,
  maxTries = 10,
} = {}) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryListen(nextPort) {
      attempt += 1;
      let server;

      const onError = (error) => {
        server.off('listening', onListening);

        if (error?.code === 'EADDRINUSE' && attempt < maxTries) {
          tryListen(nextPort + 1);
          return;
        }

        if (error?.code === 'EADDRINUSE') {
          reject(new Error(`No available port found after ${maxTries} attempts.`));
          return;
        }

        reject(error);
      };

      const onListening = () => {
        server.off('error', onError);
        resolve({ server, port: nextPort });
      };

      server = app.listen(nextPort, host);
      server.once('error', onError);
      server.once('listening', onListening);
    }

    tryListen(port);
  });
}
