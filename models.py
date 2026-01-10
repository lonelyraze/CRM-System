from sqlalchemy import Column, Integer, String, Boolean
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)
    password = Column(String)  
    plain_password = Column(String, nullable=True)  
    role = Column(String, default="user")
    is_admin = Column(Boolean, default=False)

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True)
    topic = Column(String) 
    sip_number = Column(String, nullable=True)
    error_text = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    sms_text = Column(String, nullable=True)
    status = Column(String, default="opened")
    owner = Column(String)
    created_at = Column(String, default="now")

class SmsTemplate(Base):
    __tablename__ = "sms_templates"
    id = Column(Integer, primary_key=True)
    title = Column(String)
    text = Column(String)

class TicketComment(Base):
    __tablename__ = "ticket_comments"
    id = Column(Integer, primary_key=True)
    ticket_id = Column(Integer)
    author = Column(String)
    text = Column(String)
    created_at = Column(String, default="now")