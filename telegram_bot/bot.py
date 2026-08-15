#!/usr/bin/env python3
"""
Telegram Bot Script
A simple echo bot that responds to messages
"""

import logging
import os
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot token - Replace with your bot token from BotFather
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE')

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a message when the command /start is issued."""
    user = update.effective_user
    await update.message.reply_html(
        f"مرحبا {user.mention_html()}!\n\n"
        "أنا بوت تيليجرام بسيط. أرسل لي أي رسالة وسأرد عليك!\n\n"
        "Hello! I'm a simple Telegram bot. Send me any message and I'll reply!\n\n"
        "Commands:\n"
        "/start - Start the bot\n"
        "/help - Show help\n"
        "/info - Show bot information"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a message when the command /help is issued."""
    await update.message.reply_text(
        "أوامر البوت:\n"
        "/start - بدء المحادثة\n"
        "/help - عرض المساعدة\n"
        "/info - معلومات عن البوت\n\n"
        "Bot Commands:\n"
        "/start - Start conversation\n"
        "/help - Show help\n"
        "/info - Bot information\n\n"
        "Just send me any message and I'll echo it back!"
    )

async def info_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send bot information."""
    await update.message.reply_text(
        "🤖 معلومات البوت:\n"
        "الاسم: Echo Bot\n"
        "اللغة: Python\n"
        "المكتبة: python-telegram-bot\n"
        "الإصدار: 1.0\n\n"
        "Bot Information:\n"
        "Name: Echo Bot\n"
        "Language: Python\n"
        "Library: python-telegram-bot\n"
        "Version: 1.0"
    )

async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Echo the user message."""
    user_message = update.message.text
    user = update.effective_user

    # Log the message
    logger.info(f"Message from {user.first_name} ({user.id}): {user_message}")

    # Create response
    response = f"تم استلام رسالتك: {user_message}\n\nYour message: {user_message}"

    await update.message.reply_text(response)

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Log the error and send a telegram message to notify the developer."""
    logger.error(msg="Exception while handling an update:", exc_info=context.error)

    # You can send error messages to a specific chat for debugging
    # await context.bot.send_message(chat_id=DEVELOPER_CHAT_ID, text=f"An error occurred: {context.error}")

def main() -> None:
    """Start the bot."""
    if BOT_TOKEN == 'YOUR_BOT_TOKEN_HERE':
        print("❌ يرجى تعيين رمز البوت في متغير البيئة TELEGRAM_BOT_TOKEN")
        print("Please set the bot token in the TELEGRAM_BOT_TOKEN environment variable")
        print("\nللحصول على رمز البوت:")
        print("1. اذهب إلى @BotFather على تيليجرام")
        print("2. أرسل /newbot")
        print("3. اتبع التعليمات")
        print("4. انسخ الرمز وضعه في متغير البيئة")
        print("\nTo get a bot token:")
        print("1. Go to @BotFather on Telegram")
        print("2. Send /newbot")
        print("3. Follow the instructions")
        print("4. Copy the token and set it as environment variable")
        return

    # Create the Application
    application = Application.builder().token(BOT_TOKEN).build()

    # Add command handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("info", info_command))

    # Add message handler for all text messages
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))

    # Add error handler
    application.add_error_handler(error_handler)

    # Start the bot
    print("🤖 البوت يعمل الآن...")
    print("Bot is running...")
    print("اضغط Ctrl+C لإيقاف البوت")
    print("Press Ctrl+C to stop the bot")

    # Run the bot until the user presses Ctrl-C
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
