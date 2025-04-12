import mysql.connector
import json

# Conexión a la base de datos
conn = mysql.connector.connect(
    host="localhost",
    port=3306,
    user="root",
    password="root",
    database="erp_local"
)

cursor = conn.cursor()

# Mostrar solo las tablas reales (no vistas)
cursor.execute("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
tables = [row[0] for row in cursor.fetchall()]

schema = {}

for table in tables:
    try:
        cursor.execute(f"DESCRIBE `{table}`")
        columns = cursor.fetchall()
        schema[table] = [col[0] for col in columns]
    except Exception as e:
        print(f"❌ Error leyendo tabla {table}: {e}")

cursor.close()
conn.close()

# Guardar como archivo JSON
with open("schema.json", "w", encoding="utf-8") as f:
    json.dump(schema, f, indent=2, ensure_ascii=False)

print("✅ Esquema exportado con éxito a schema.json")
