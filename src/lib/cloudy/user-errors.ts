export type UserErrorContext = "auth" | "ai" | "progress" | "generic";

function errorText(error: unknown): string {
  if (typeof error === "string") return error.toLowerCase();
  if (error instanceof Error) return error.message.toLowerCase();
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown; status?: unknown; statusCode?: unknown };
    return [value.message, value.code, value.status, value.statusCode]
      .filter((part) => part !== undefined && part !== null)
      .map(String)
      .join(" ")
      .toLowerCase();
  }
  return "";
}

/** Converts internal failures into safe, actionable messages for ordinary learners. */
export function toUserErrorMessage(error: unknown, context: UserErrorContext = "generic"): string {
  const text = errorText(error);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Нет подключения к интернету. Проверьте сеть и повторите попытку.";
  }
  if (/сначала войдите в аккаунт|войдите в аккаунт|войти в аккаунт/i.test(text)) {
    return "Чтобы общаться с Cloudy, войдите в свой аккаунт.";
  }
  if (/invalid login credentials|invalid_credentials|wrong password|email or password/i.test(text)) {
    return "Не удалось войти: проверьте email и пароль. Если пароль забыт, воспользуйтесь восстановлением доступа.";
  }
  if (/user already registered|already been registered|email.*already|duplicate/i.test(text)) {
    return "Этот email уже зарегистрирован. Войдите в существующий аккаунт или используйте другой адрес.";
  }
  if (/email not confirmed|email_not_confirmed|confirm your email/i.test(text)) {
    return "Сначала подтвердите email по ссылке в письме, затем попробуйте войти снова.";
  }
  if (/слишком много запросов к ии|лимит обращений к ии|уже выполняются запросы к ии|сервис ии временно недоступен/i.test(text) && error instanceof Error) return error.message;
  if (/rate.?limit|too many requests|over_email_send_rate_limit/i.test(text)) {
    return "Слишком много попыток за короткое время. Подождите немного и повторите.";
  }
  if (/jwt expired|token.*expired|refresh_token_not_found|session.*missing|unauthorized/i.test(text)) {
    return "Сеанс завершился. Войдите в аккаунт снова, чтобы продолжить.";
  }
  if (/aborterror|timed? ?out|timeout|deadline exceeded/i.test(text)) {
    return context === "ai"
      ? "Ответ не успел прийти. Проверьте соединение и отправьте сообщение ещё раз."
      : "Операция заняла слишком много времени. Проверьте соединение и повторите попытку.";
  }
  if (/cloudy content database is not configured|не настроен публичный ключ cloudy content|cloudy content.*(not configured|missing)|relation .*shorts_videos.*does not exist|bucket.*not found/i.test(text)) {
    return "Публикация Shorts пока не настроена на сервере. Видео не отправлено. Попробуйте позже.";
  }
  if (/failed to fetch|networkerror|fetch failed|load failed|network request/i.test(text)) {
    return "Не удалось связаться с сервисом. Проверьте интернет и попробуйте ещё раз.";
  }
  if (context === "ai") {
    return "Сейчас не удалось получить ответ. Ваше сообщение могло не отправиться — проверьте чат и при необходимости отправьте его ещё раз.";
  }
  if (context === "progress") {
    return "Не удалось сохранить прогресс в облаке. Данные на этом устройстве могут оставаться доступными; проверьте интернет и повторите попытку.";
  }
  if (context === "auth") {
    return "Не удалось выполнить действие с аккаунтом. Проверьте данные и подключение к интернету, затем попробуйте снова.";
  }
  return "Что-то пошло не так. Попробуйте ещё раз. Если ошибка повторится, обратитесь в поддержку.";
}
