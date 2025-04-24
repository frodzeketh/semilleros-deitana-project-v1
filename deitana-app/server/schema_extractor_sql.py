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
sql_output = ""

for table in tables:
    try:
        cursor.execute(f"DESCRIBE `{table}`")
        columns = cursor.fetchall()
        column_names = [col[0] for col in columns]
        schema[table] = column_names

        # Generar SQL con PRIMARY KEY si existe 'id'
        sql_output += f"CREATE TABLE `{table}` (\n"
        lines = []

        for col in column_names:
            tipo = "INT" if col.lower() == "id" else "TEXT"
            lines.append(f"  `{col}` {tipo}")

        # Agrega la PRIMARY KEY si existe columna 'id'
        if "id" in column_names:
            lines.append("  PRIMARY KEY (`id`)")

        sql_output += ",\n".join(lines)
        sql_output += "\n);\n\n"

    except Exception as e:
        print(f"❌ Error leyendo tabla {table}: {e}")

cursor.close()
conn.close()

# Guardar como archivo JSON
with open("schema.json", "w", encoding="utf-8") as f:
    json.dump(schema, f, indent=2, ensure_ascii=False)

# Guardar archivo SQL
with open("estructura_generada.sql", "w", encoding="utf-8") as f:
    f.write(sql_output)

print("✅ Exportado con PRIMARY KEY en estructura_generada.sql y schema.json")
