import asyncio
import pty
import os
async def test():
    master_fd, slave_fd = pty.openpty()
    try:
        proc = await asyncio.create_subprocess_exec("bash", "-i", stdin=slave_fd, stdout=slave_fd, stderr=slave_fd)
        print("Success!")
        proc.terminate()
    except Exception as e:
        print(f"Error: {e}")
asyncio.run(test())
