FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if any are needed
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Set environment variables
ENV PORT=7860
ENV PYTHONUNBUFFERED=1

# Expose the port the app runs on
EXPOSE 7860

# Command to run the application
# We use 0.0.0.0 to make it accessible outside the container
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "app:app"]
