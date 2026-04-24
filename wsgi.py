import sys
import os

# This file is used by production servers like Gunicorn or PythonAnywhere
path = os.path.dirname(os.path.abspath(__file__))
if path not in sys.path:
    sys.path.append(path)

from app import app as application
