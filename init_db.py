from database import engine, Base
import models

# Создаем все таблицы
Base.metadata.create_all(bind=engine)
print("Таблицы созданы успешно!")