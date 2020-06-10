import React from 'react';
import { Nav, Icon, Navbar } from 'rsuite'

const Header: React.FunctionComponent = () => {
  return (
    <Navbar appearance="inverse">
      <Navbar.Header>
        <Nav>
          <Nav.Item href="https://playwright.tech">
            <strong>Playwright Community</strong>{' '}
            <span role="img" aria-label="Playwright">🎭</span>
          </Nav.Item>
        </Nav>
      </Navbar.Header>
      <Navbar.Body>
        <Nav pullRight>
          <Nav.Item href="https://playwright.dev" target="_blank" rel="noopener noreferrer" icon={<Icon icon="info-circle" />}>Documentation</Nav.Item>
          <Nav.Item href="https://github.com/mxschmitt/try-playwright" icon={<Icon icon="github" />}>
            View Source
          </Nav.Item>
        </Nav>
      </Navbar.Body>
    </Navbar>
  )
}

export default Header;
