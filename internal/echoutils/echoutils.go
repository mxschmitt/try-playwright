package echoutils

import (
	"github.com/labstack/echo/v4"
)

func HTTPErrorHandler(e *echo.Echo) func(err error, c echo.Context) {
	return func(err error, c echo.Context) {
		e.Logger.Error(err)
		e.DefaultHTTPErrorHandler(err, c)
	}
}
