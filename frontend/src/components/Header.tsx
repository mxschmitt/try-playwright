import React from 'react';
import { Nav, Icon, Navbar } from 'rsuite'

const Header: React.FunctionComponent = () => {
  return (
    <Navbar appearance="inverse">
      <Navbar.Header>
        <Nav>
          <Nav.Item><strong>Try Playwright</strong></Nav.Item>
        </Nav>
      </Navbar.Header>
      <Navbar.Body>
        <Nav pullRight>
          <Nav.Item href="https://github.com/mxschmitt/try-playwright" icon={<Icon icon="github" />}>
            View Source
          </Nav.Item>
        </Nav>
      </Navbar.Body>
    </Navbar>
    )
  }

  export default Header;