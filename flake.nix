{
  description = "linear-cli - CLI for Linear via GraphQL API";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, git-hooks }:
    let
      version = "0.2.1";

      # Binary hashes for releases - update these after each release
      # Run: nix-prefetch-url --type sha256 <url>
      # Then: nix hash to-sri --type sha256 <hash>
      binaries = {
        "aarch64-darwin" = {
          url = "https://github.com/aliou/linear-cli/releases/download/v${version}/linear-darwin-arm64";
          hash = "sha256-OSmWjZEu3KLbqRAk5MQSWDQ7pGq6F5/ZNJdWnDvastM="; # darwin
        };
        "aarch64-linux" = {
          url = "https://github.com/aliou/linear-cli/releases/download/v${version}/linear-linux-arm64";
          hash = "sha256-zVrz9INFsOmqxalY6dAP4VnEnu/y4Ge9k0IGJ86wITo="; # linux-arm64
        };
        "x86_64-linux" = {
          url = "https://github.com/aliou/linear-cli/releases/download/v${version}/linear-linux-x64";
          hash = "sha256-mo9gXwcG7y9NmjAcqaHboX/spq7k5FTV8ZaJi+k2GA4="; # linux-x64
        };
      };

      # Build from source for development
      buildFromSource = pkgs: pkgs.stdenv.mkDerivation {
        pname = "linear-cli";
        inherit version;

        src = ./.;

        nativeBuildInputs = [ pkgs.bun pkgs.makeWrapper ];

        buildPhase = ''
          export HOME=$(mktemp -d)
          bun install --frozen-lockfile
        '';

        installPhase = ''
          mkdir -p $out/lib/linear-cli
          cp -r node_modules $out/lib/linear-cli/
          cp -r src $out/lib/linear-cli/
          cp package.json $out/lib/linear-cli/

          mkdir -p $out/bin
          cat > $out/bin/linear << 'EOF'
          #!/usr/bin/env bash
          exec ${pkgs.bun}/bin/bun run "$out/lib/linear-cli/src/index.ts" "$@"
          EOF
          chmod +x $out/bin/linear

          substituteInPlace $out/bin/linear --replace '$out' "$out"
        '';

        meta = with pkgs.lib; {
          description = "CLI for Linear via GraphQL API";
          homepage = "https://github.com/aliou/linear-cli";
          license = licenses.mit;
          platforms = platforms.all;
          mainProgram = "linear";
        };
      };

      # Fetch prebuilt binary from release
      fetchBinary = pkgs: system:
        let
          binary = binaries.${system} or (throw "Unsupported system: ${system}");
        in
        pkgs.stdenv.mkDerivation {
          pname = "linear-cli";
          inherit version;

          src = pkgs.fetchurl {
            url = binary.url;
            hash = binary.hash;
          };

          dontUnpack = true;

          installPhase = ''
            mkdir -p $out/bin
            cp $src $out/bin/linear
            chmod +x $out/bin/linear
          '';

          meta = with pkgs.lib; {
            description = "CLI for Linear via GraphQL API";
            homepage = "https://github.com/aliou/linear-cli";
            license = licenses.mit;
            platforms = [ "aarch64-darwin" "aarch64-linux" "x86_64-linux" ];
            mainProgram = "linear";
          };
        };
    in
    flake-utils.lib.eachSystem [ "aarch64-darwin" "aarch64-linux" "x86_64-linux" ] (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        linear-cli = buildFromSource pkgs;

        pre-commit-check = git-hooks.lib.${system}.run {
          src = ./.;
          hooks = {
            biome-format = {
              enable = true;
              name = "biome format";
              entry = "${pkgs.bun}/bin/bun run format";
              files = "\\.(ts|json)$";
              pass_filenames = false;
            };
            typecheck = {
              enable = true;
              name = "typecheck";
              entry = "${pkgs.bun}/bin/bun run typecheck";
              files = "\\.ts$";
              pass_filenames = false;
            };
          };
        };
      in
      {
        checks = {
          pre-commit-check = pre-commit-check;
        };

        packages = {
          default = linear-cli;
          linear-cli = linear-cli;
          linear-cli-binary = fetchBinary pkgs system;
        };

        apps.default = {
          type = "app";
          program = "${linear-cli}/bin/linear";
        };

        devShells.default = pkgs.mkShell {
          inherit (pre-commit-check) shellHook;
          buildInputs = [ pkgs.bun ];
        };
      }
    );
}
