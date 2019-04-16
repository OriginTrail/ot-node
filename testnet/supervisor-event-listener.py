import sys
import os
import signal

def write_stdout(s):
    # only eventlistener protocol messages may be sent to stdout
    sys.stdout.write(s)
    sys.stdout.flush()

def write_stderr(s):
    sys.stderr.write(s)
    sys.stderr.flush()

def main():
    while 1:
        # transition from ACKNOWLEDGED to READY
        write_stdout('READY\n')

        # read header line and print it to stderr
        line = sys.stdin.readline()
        # write_stderr(line)

        # read event payload and print it to stderr
        headers = dict([ x.split(':') for x in line.split() ])
        data = sys.stdin.read(int(headers['len']))
        payload = dict([ x.split(':') for x in data.split() ])
        if headers['eventname'] == 'PROCESS_STATE_EXITED' and 'processname' in payload and payload['processname'] == 'otnode':
            if payload['expected'] == '1':
                # OT Node exited normally. Exit from container.
                # write_stderr('HEADERS ' + line)
                # write_stderr(data)
                # write_stderr('\n')
                os.kill(1, signal.SIGTERM)

        # transition from READY to ACKNOWLEDGED
        write_stdout('RESULT 2\nOK')

if __name__ == '__main__':
    main()
