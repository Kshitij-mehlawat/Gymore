import sys
import os

# Add your project directory to the sys.path
path = '/home/YOUR_PYTHONANYWHERE_USERNAME/Gymore'
if path not in sys.path:
    sys.path.append(path)

from app import app as application
