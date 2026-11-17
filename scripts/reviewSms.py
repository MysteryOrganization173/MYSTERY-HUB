"""Run the current SMS Communications Studio browser acceptance flow."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('reviewSmsStudio.py')),run_name='__main__')
