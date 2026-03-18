import sqlite3

db_path = "backend/fairaudit.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("Adding 'recommendations' column to 'audit_reports'...")
    cursor.execute("ALTER TABLE audit_reports ADD COLUMN recommendations TEXT;")
    print("Added 'recommendations' column.")
except sqlite3.OperationalError as e:
    print(f"Skipped 'recommendations': {e}")

try:
    print("Adding 'column_mapping' column to 'audit_reports'...")
    cursor.execute("ALTER TABLE audit_reports ADD COLUMN column_mapping TEXT;")
    print("Added 'column_mapping' column.")
except sqlite3.OperationalError as e:
    print(f"Skipped 'column_mapping': {e}")

conn.commit()
conn.close()
print("Migration complete!")
