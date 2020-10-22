import React from 'react';
import { Nav, Icon, Navbar } from 'rsuite'

import styles from './Header.module.css'

const Header: React.FunctionComponent = () => {
  return (
    <Navbar appearance="inverse">
      <Navbar.Header>
        <Nav>
          <Nav.Item href="https://playwright.tech">
            <strong className={styles.hideSuperSmall}>Try</strong>{' '}
            <strong>Playwright</strong>{' '}
            <span role="img" aria-label="Playwright">🎭</span>
          </Nav.Item>
        </Nav>
      </Navbar.Header>
      <Navbar.Body>
        <Nav pullRight>
          <Nav.Item href="https://playwright.dev" target="_blank" rel="noopener noreferrer" icon={<Icon icon="info-circle" />}>Documentation</Nav.Item>
          <Nav.Item href="https://github.com/mxschmitt/try-playwright" icon={<Icon icon="github" />}>
            <span className={styles.hideSuperSmall}>
              View
            </span>
            {' '}
            Source
          </Nav.Item>
        </Nav>
      </Navbar.Body>
    </Navbar>
  )
}

export default Header;
