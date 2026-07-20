import asyncio
import pty
import os
import fcntl

async def test():
    master_fd, slave_fd = pty.openpty()
    proc = await asyncio.create_subprocess_exec("bash", "-i", stdin=slave_fd, stdout=slave_fd, stderr=slave_fd, preexec_fn=os.setsid)
    os.close(slave_fd)
    
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
    
    loop = asyncio.get_event_loop()
    try:
        data = await loop.run_in_executor(None, os.read, master_fd, 4096)
        print("Read:", data)
        await asyncio.sleep(2)
        data = await loop.run_in_executor(None, os.read, master_fd, 4096)
        print("Read2:", data)
    except Exception as e:
        print("Error:", e)
        
    proc.terminate()
asyncio.run(test())
