import pymysql

usernames = ['gymore', 'Gymore', 'root']
ports = [3306, 3307, 3308, 3309, 3310]
password = 'Yashyadav_123'

success = False
for port in ports:
    for user in usernames:
        try:
            print(f"Trying user={user} on port={port}...")
            conn = pymysql.connect(
                host='127.0.0.1',
                port=port,
                user=user,
                password=password,
                connect_timeout=2
            )
            print(f"SUCCESS: Connected with user={user} on port={port}")
            
            # Check if database 'gymore' exists
            cursor = conn.cursor()
            cursor.execute("SHOW DATABASES LIKE 'gymore'")
            if cursor.fetchone():
                print("Database 'gymore' already exists.")
            else:
                print("Creating database 'gymore'...")
                cursor.execute("CREATE DATABASE gymore")
            
            conn.close()
            success = True
            break
        except Exception as e:
            print(f"Failed: {e}")
    if success:
        break

if not success:
    print("\nCould not connect to MySQL on any common port with the provided credentials.")
    print("Please make sure your MySQL server is running.")
