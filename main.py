from fastapi import FastAPI, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
import asyncio, json
import time
import os
from datetime import datetime, timedelta
from database import SessionLocal, engine
from models import User, Ticket, Base, SmsTemplate, TicketComment
from typing import Optional
from database import engine, Base
import models

Base.metadata.create_all(bind=engine)

from database import SessionLocal
from models import User

# СОЗДАЕМ APP ТОЛЬКО ОДИН РАЗ!
app = FastAPI()

# Получаем секретный ключ
SECRET_KEY = os.environ.get("SECRET_KEY", "ticket-system-small-team-2024-secret")

# Добавляем SessionMiddleware ТОЛЬКО ОДИН РАЗ!
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="ticket_session",
    max_age=3600 * 24 * 7,  # 7 дней
    same_site="lax",
    https_only=False,
    secure=False
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

from auth import hash_password


def ensure_admin():
    db = SessionLocal()

    admin = db.query(User).filter(User.username == "raze").first()

    if not admin:
        admin = User(
            username="raze",
            password=hash_password("raze"),
            is_admin=True
        )
        db.add(admin)
        db.commit()
        print("✅ Admin raze created (hashed)")

    else:
        if not admin.password.startswith("$2"):
            admin.password = hash_password("raze")
            db.commit()
            print("🔁 Admin password re-hashed")

    db.close()

ensure_admin()



clients = []
user_clients = []

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/login")
def login(request: Request, username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    from auth import verify_password
    user = db.query(User).filter(User.username == username).first()
    if not user:
        # Добавляем небольшую задержку для безопасности
        time.sleep(0.5)
        return RedirectResponse("/", status_code=302)

    if not verify_password(password, user.password):
        time.sleep(0.5)
        return RedirectResponse("/", status_code=302)

    # Устанавливаем сессию
    request.session["user"] = user.username
    request.session["is_admin"] = user.is_admin
    
    # Редирект в зависимости от роли
    if user.is_admin:
        return RedirectResponse("/admin", status_code=302)
    else:
        return RedirectResponse("/tickets", status_code=302)

@app.get("/tickets")
def tickets(
    request: Request, 
    partial: Optional[bool] = False, 
    db: Session = Depends(get_db)
):
    # Проверяем авторизацию
    user = request.session.get("user")
    if not user:
        return RedirectResponse("/", 302)

    # Получаем пользователя из БД для проверки
    db_user = db.query(User).filter_by(username=user).first()
    if not db_user:
        # Если пользователя нет в БД, очищаем сессию
        request.session.clear()
        return RedirectResponse("/", status_code=302)
    
    # Устанавливаем is_admin в сессию (если еще не установлено)
    if "is_admin" not in request.session:
        request.session["is_admin"] = db_user.is_admin
    
    # Получаем тикеты в зависимости от прав - НОВЫЕ ПЕРВЫМИ
    if db_user.is_admin:
        tickets_data = db.query(Ticket).order_by(Ticket.id.desc()).all()
    else:
        tickets_data = db.query(Ticket).filter_by(owner=user).order_by(Ticket.id.desc()).all()

    # Если запрос на частичное обновление (AJAX) - возвращаем JSON
    if partial:
        result = []
        for ticket in tickets_data:
            result.append({
                "id": ticket.id,
                "status": ticket.status,
                "topic": ticket.topic,
                "error_text": ticket.error_text,
                "sms_text": ticket.sms_text,
                "sip_number": ticket.sip_number,
                "phone_number": ticket.phone_number,
                "created_at": ticket.created_at if hasattr(ticket, 'created_at') else "Сегодня",
                "comments_count": db.query(TicketComment).filter_by(ticket_id=ticket.id).count()
            })
        return JSONResponse(content=result)

    # Для каждого тикета получаем комментарии (для полного рендеринга)
    tickets_with_comments = []
    for ticket in tickets_data:
        comments = db.query(TicketComment).filter_by(ticket_id=ticket.id).order_by(TicketComment.id.desc()).all()
        tickets_with_comments.append({
            "ticket": ticket,
            "comments": comments
        })

    return templates.TemplateResponse(
        "tickets.html",
        {
            "request": request,
            "tickets_with_comments": tickets_with_comments,
            "is_admin": db_user.is_admin,
            "current_user": db_user
        }
    )

@app.post("/tickets/create")
async def create_ticket(request: Request, topic: str = Form(...), sip: str = Form(None),
                        error: str = Form(None), phone: str = Form(None), text: str = Form(None),
                        db: Session = Depends(get_db)):
    current_time = datetime.now().strftime("%d.%m.%Y %H:%M")
    
    t = Ticket(
        topic=topic, 
        sip_number=sip, 
        error_text=error,
        phone_number=phone, 
        sms_text=text,
        owner=request.session.get("user"),
        created_at=current_time
    )
    db.add(t)
    db.commit()
    
    for q in clients:
        await q.put("update")
    
    return RedirectResponse("/tickets", status_code=302)

@app.get("/admin", response_class=HTMLResponse)
def admin(request: Request, db: Session = Depends(get_db)):
    # Проверяем авторизацию
    user = request.session.get("user")
    if not user:
        return RedirectResponse("/", status_code=302)
    
    # Проверяем, что пользователь админ
    db_user = db.query(User).filter_by(username=user).first()
    if not db_user or not db_user.is_admin:
        return RedirectResponse("/tickets", status_code=302)
    
    return templates.TemplateResponse("admin.html", {"request": request})

# ⚠️ УДАЛИТЬ ДУБЛИРУЮЩИЙСЯ ЭНДПОИНТ!
# У вас был два одинаковых:
# @app.get("/admin/api/tickets")
# Оставляем только ОДИН:

@app.get("/admin/api/tickets")
def get_tickets_api(db: Session = Depends(get_db)):
    tickets = db.query(Ticket).order_by(Ticket.id.desc()).all()
    result = []
    for ticket in tickets:
        ticket_dict = {
            "id": ticket.id,
            "topic": ticket.topic,
            "sip_number": ticket.sip_number,
            "error_text": ticket.error_text,
            "phone_number": ticket.phone_number,
            "sms_text": ticket.sms_text,
            "status": ticket.status,
            "owner": ticket.owner,
            "created_at": getattr(ticket, 'created_at', 'Сегодня'),
            "comments_count": db.query(TicketComment).filter_by(ticket_id=ticket.id).count()
        }
        result.append(ticket_dict)
    return JSONResponse(content=result)

@app.post("/admin/status")
async def update_status(request: Request, db: Session = Depends(get_db)):
    form_data = await request.form()
    ticket_id = int(form_data.get('ticket_id'))
    status = form_data.get('status')
    
    t = db.query(Ticket).get(ticket_id)
    if t:
        old_status = t.status
        t.status = status
        db.commit()
        
        # Отправляем уведомление админам
        for q in clients:
            await q.put("update")
            
        # Отправляем уведомление владельцу тикета
        for q in user_clients:
            await q.put("update")
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Статус изменен с '{old_status}' на '{status}'"
        })
    
    return JSONResponse(content={"status": "error"}, status_code=400)

@app.get("/events")
async def events(request: Request):
    user = request.session.get("user")
    
    async def stream():
        q = asyncio.Queue()
        clients.append(q)  # Для админов
        
        # Для пользователей тоже добавляем в общую очередь
        user_q = asyncio.Queue()
        user_clients.append(user_q)
        
        try:
            while True:
                # Проверяем обе очереди
                try:
                    # Для админов
                    msg = await asyncio.wait_for(q.get(), timeout=0.1)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    pass
                    
                try:
                    # Для пользователей
                    user_msg = await asyncio.wait_for(user_q.get(), timeout=0.1)
                    yield f"data: {user_msg}\n\n"
                except asyncio.TimeoutError:
                    pass
                    
                await asyncio.sleep(0.1)
        finally:
            clients.remove(q)
            user_clients.remove(user_q)
    
    return StreamingResponse(stream(), media_type="text/event-stream")

@app.get("/sms/templates")
def get_sms_templates(db: Session = Depends(get_db)):
    templates = db.query(SmsTemplate).all()
    return JSONResponse(content=[{"id": t.id, "title": t.title, "text": t.text} for t in templates])

@app.get("/admin/api/sms-templates")
def get_sms_templates_api(db: Session = Depends(get_db)):
    templates = db.query(SmsTemplate).all()
    return JSONResponse(content=[{"id": t.id, "title": t.title, "text": t.text} for t in templates])

@app.post("/admin/sms-template")
async def create_sms_template(request: Request, db: Session = Depends(get_db)):
    form_data = await request.form()
    title = form_data.get('title')
    text = form_data.get('text')
    
    tpl = SmsTemplate(title=title, text=text)
    db.add(tpl)
    db.commit()
    return JSONResponse(content={"status": "success", "id": tpl.id})

@app.delete("/admin/sms-template/{template_id}")
def delete_sms_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(SmsTemplate).get(template_id)
    if template:
        db.delete(template)
        db.commit()
    return JSONResponse(content={"status": "success"})

@app.put("/admin/sms-template/{template_id}")
async def update_sms_template(template_id: int, request: Request, db: Session = Depends(get_db)):
    form_data = await request.form()
    title = form_data.get('title')
    text = form_data.get('text')
    
    template = db.query(SmsTemplate).get(template_id)
    if not template:
        return JSONResponse(content={"error": "Шаблон не найден"}, status_code=404)
    
    if title:
        template.title = title
    if text:
        template.text = text
    
    db.commit()
    return JSONResponse(content={"status": "success"})

@app.post("/tickets/comment")
async def add_comment(request: Request, db: Session = Depends(get_db)):
    form_data = await request.form()
    ticket_id = int(form_data.get('ticket_id'))
    text = form_data.get('text')
    
    current_time = datetime.now().strftime("%d.%m.%Y %H:%M")
    
    c = TicketComment(
        ticket_id=ticket_id,
        author=request.session.get("user"),
        text=text,
        created_at=current_time
    )
    db.add(c)
    db.commit()

    for q in clients:
        await q.put("update")
    
    for q in user_clients:
        await q.put("update")

    return JSONResponse(content={"status": "success"})

@app.get("/tickets/{ticket_id}/comments")
def get_comments(ticket_id: int, db: Session = Depends(get_db)):
    comments = db.query(TicketComment).filter_by(ticket_id=ticket_id).order_by(TicketComment.id).all()
    result = [
        {
            "id": c.id,
            "author": c.author,
            "text": c.text,
            "created_at": getattr(c, 'created_at', 'Только что')
        }
        for c in comments
    ]
    return JSONResponse(content=result)

@app.get("/admin/api/comments")
def get_all_comments(db: Session = Depends(get_db)):
    comments = db.query(TicketComment).order_by(TicketComment.id.desc()).all()
    result = []
    for c in comments:
        ticket = db.query(Ticket).filter_by(id=c.ticket_id).first()
        result.append({
            "id": c.id,
            "ticket_id": c.ticket_id,
            "author": c.author,
            "text": c.text,
            "created_at": getattr(c, 'created_at', 'Только что'),
            "ticket_topic": ticket.topic if ticket else "Неизвестно"
        })
    return JSONResponse(content=result)

@app.delete("/admin/comment/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    comment = db.query(TicketComment).get(comment_id)
    if comment:
        db.delete(comment)
        db.commit()
        return JSONResponse(content={"status": "success"})
    return JSONResponse(content={"error": "Комментарий не найден"}, status_code=404)

@app.delete("/admin/ticket/{ticket_id}")
async def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).get(ticket_id)
    if ticket:
        # Сохраняем owner для отправки уведомления
        ticket_owner = ticket.owner
        
        # Удаляем все комментарии тикета
        db.query(TicketComment).filter_by(ticket_id=ticket_id).delete()
        # Удаляем сам тикет
        db.delete(ticket)
        db.commit()
        
        # Отправляем уведомление админам
        for q in clients:
            await q.put("update")
        
        # Отправляем уведомление пользователю (владельцу тикета)
        for q in user_clients:
            await q.put("update")
        
        # Также отправляем конкретное событие о удалении тикета
        for q in user_clients:
            await q.put(f"delete_ticket:{ticket_id}")
        
        return JSONResponse(content={"status": "success"})
    return JSONResponse(content={"error": "Тикет не найден"}, status_code=404)

@app.get("/admin/api/users")
def get_users_api(db: Session = Depends(get_db)):
    users = db.query(User).all()
    result = [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "is_admin": u.is_admin,
            "password": u.password
        }
        for u in users
    ]
    return JSONResponse(content=result)

@app.post("/admin/user")
async def create_user(request: Request, db: Session = Depends(get_db)):
    form_data = await request.form()
    username = form_data.get('username')
    password = form_data.get('password')
    role = form_data.get('role', 'user')
    is_admin = form_data.get('is_admin') == 'true'
    
    # Проверяем, существует ли пользователь
    existing_user = db.query(User).filter_by(username=username).first()
    if existing_user:
        return JSONResponse(content={"error": "Пользователь уже существует"}, status_code=400)
    
    user = User(
        username=username,
        password=hash_password(password),
        role=role,
        is_admin=is_admin
    )
    db.add(user)
    db.commit()
    return JSONResponse(content={"status": "success", "id": user.id})

@app.put("/admin/user/{user_id}")
async def update_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    form_data = await request.form()
    
    user = db.query(User).get(user_id)
    if not user:
        return JSONResponse(content={"error": "Пользователь не найден"}, status_code=404)
    
    if 'username' in form_data:
        user.username = form_data.get('username')
    if 'password' in form_data:
        password = form_data.get('password')
        if password:  # Обновляем пароль только если он не пустой
            from auth import hash_password
            user.password = hash_password(password)
    if 'role' in form_data:
        user.role = form_data.get('role')
    if 'is_admin' in form_data:
        user.is_admin = form_data.get('is_admin') == 'true'
    
    db.commit()
    return JSONResponse(content={"status": "success"})

@app.delete("/admin/user/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).get(user_id)
    if user:
        db.delete(user)
        db.commit()
    return JSONResponse(content={"status": "success"})

@app.post("/admin/cleanup")
async def cleanup_data(request: Request, db: Session = Depends(get_db)):
    form_data = await request.form()
    days = form_data.get('days')
    cleanup_type = form_data.get('type')
    
    deleted_count = 0
    
    if cleanup_type == 'tickets' and days != 'all':
        # Удаляем завершенные тикеты старше X дней
        cutoff_date = datetime.now() - timedelta(days=int(days))
        cutoff_str = cutoff_date.strftime("%d.%m.%Y %H:%M")
        
        # Получаем все тикеты и фильтруем вручную
        all_tickets = db.query(Ticket).filter_by(status='done').all()
        for ticket in all_tickets:
            try:
                ticket_date = datetime.strptime(ticket.created_at, "%d.%m.%Y %H:%M")
                if ticket_date < cutoff_date:
                    db.query(TicketComment).filter_by(ticket_id=ticket.id).delete()
                    db.delete(ticket)
                    deleted_count += 1
            except:
                pass
                
    elif cleanup_type == 'tickets' and days == 'all':
        # Удаляем все завершенные тикеты
        done_tickets = db.query(Ticket).filter_by(status='done').all()
        for ticket in done_tickets:
            db.query(TicketComment).filter_by(ticket_id=ticket.id).delete()
            db.delete(ticket)
            deleted_count += 1
            
    elif cleanup_type == 'comments' and days != 'all':
        # Удаляем комментарии старше X дней
        cutoff_date = datetime.now() - timedelta(days=int(days))
        
        all_comments = db.query(TicketComment).all()
        for comment in all_comments:
            try:
                comment_date = datetime.strptime(comment.created_at, "%d.%m.%Y %H:%M")
                if comment_date < cutoff_date:
                    db.delete(comment)
                    deleted_count += 1
            except:
                pass
                
    elif cleanup_type == 'comments' and days == 'all':
        # Удаляем все комментарии
        all_comments = db.query(TicketComment).all()
        for comment in all_comments:
            db.delete(comment)
            deleted_count += 1
    
    db.commit()
    return JSONResponse(content={"status": "success", "deleted_count": deleted_count})

@app.delete("/admin/cleanup/all-tickets")
def delete_all_tickets(db: Session = Depends(get_db)):
    # Удаляем все тикеты и их комментарии
    deleted_count = 0
    
    # Сначала удаляем все комментарии
    db.query(TicketComment).delete()
    
    # Затем удаляем все тикеты
    tickets = db.query(Ticket).all()
    for ticket in tickets:
        db.delete(ticket)
        deleted_count += 1
    
    db.commit()
    return JSONResponse(content={"status": "success", "deleted_count": deleted_count})

@app.delete("/admin/cleanup/all-comments")
def delete_all_comments(db: Session = Depends(get_db)):
    deleted_count = 0
    comments = db.query(TicketComment).all()
    
    for comment in comments:
        db.delete(comment)
        deleted_count += 1
    
    db.commit()
    return JSONResponse(content={"status": "success", "deleted_count": deleted_count})

@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/", status_code=302)

# Опционально: добавьте middleware для базовой безопасности
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response