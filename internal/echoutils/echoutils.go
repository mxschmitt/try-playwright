package echoutils

import (
	"github.com/labstack/echo/v5"
)

func HTTPErrorHandler(e *echo.Echo) echo.HTTPErrorHandler {
	defaultHandler := echo.DefaultHTTPErrorHandler(false)
	return func(c *echo.Context, err error) {
		e.Logger.Error("request error", "error", err)
		defaultHandler(c, err)
	}
}
