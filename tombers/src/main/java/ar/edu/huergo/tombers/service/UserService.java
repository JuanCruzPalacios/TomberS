package ar.edu.huergo.tombers.service;

import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import ar.edu.huergo.tombers.dto.user.UserResponse;
import ar.edu.huergo.tombers.dto.user.UserUpdateRequest;
import ar.edu.huergo.tombers.entity.Rol;
import ar.edu.huergo.tombers.entity.User;
import ar.edu.huergo.tombers.mapper.UserMapper;
import ar.edu.huergo.tombers.repository.UserRepository;
import ar.edu.huergo.tombers.repository.security.RolRepository;
import ar.edu.huergo.tombers.service.storage.FileStorageService;
import ar.edu.huergo.tombers.service.storage.StorageDirectory;
import ar.edu.huergo.tombers.service.storage.StoredFile;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final FileStorageService fileStorageService;
    private final RolRepository rolRepository;
    private final UserRatingService userRatingService;

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::toDtoWithRating)
                .toList();
    }

    /**
     * Obtiene el perfil de un usuario por su email.
     *
     * @param email el email del usuario
     * @return un objeto UserResponse que representa el perfil del usuario
     * @throws EntityNotFoundException si el usuario no existe
     */
    public UserResponse getUserProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + email));
        return toDtoWithRating(user);
    }

    private UserResponse toDtoWithRating(User user) {
        UserResponse response = userMapper.toDto(user);
        response.setAverageRating(userRatingService.getAverageRatingForUser(user.getId()));
        return response;
    }

    /**
     * Actualiza el perfil de un usuario con la informacion proporcionada.
     *
     * @param email el email del usuario
     * @param request la solicitud de actualizacion del perfil
     * @param profilePicture archivo opcional con la nueva foto de perfil
     * @return un objeto UserResponse que representa el perfil actualizado
     * @throws EntityNotFoundException si el usuario no existe
     */
    public UserResponse updateUserProfile(String email, UserUpdateRequest request, MultipartFile profilePicture) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + email));

        userMapper.updateEntity(user, request);

        if (profilePicture != null && !profilePicture.isEmpty()) {
            String previousProfilePicture = user.getProfilePictureUrl();
            StoredFile storedFile = fileStorageService.store(profilePicture, StorageDirectory.USER_PROFILE);
            String newProfileUrl = storedFile.publicUrl();
            user.setProfilePictureUrl(newProfileUrl);
            if (previousProfilePicture != null && !previousProfilePicture.equals(newProfileUrl)) {
                fileStorageService.deleteByPublicUrl(previousProfilePicture);
            }
        }

        User updatedUser = userRepository.save(user);

        return toDtoWithRating(updatedUser);
    }

    /**
     * Crea un perfil de usuario y le asigna un rol.
     *
     * @param email el email del usuario
     * @param username el nombre de usuario
     * @param role el rol a asignar
     * @return un objeto UserResponse que representa el perfil creado
     * @throws IllegalArgumentException si el usuario ya existe o el rol es
     * inválido
     */
    public UserResponse createProfile(String email, String username, String role) {
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Usuario ya existe con ese email: " + email);
        }

        // Obtener rol desde la base de datos
        Rol userRole = rolRepository.findByNombre(role.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Rol inválido: " + role));

        // Crear nuevo usuario desde cero
        User newUser = User.builder()
                .firstName("") // Valor por defecto
                .lastName("") // Valor por defecto
                .email(email)
                .username(username)
                .password("default") // Contraseña por defecto, no codificada
                .roles(Set.of(userRole))
                .status(User.UserStatus.DISPONIBLE)
                .build();

        User savedUser = userRepository.save(newUser);
        return toDtoWithRating(savedUser);
    }

    /**
     * Obtiene el perfil de un usuario por su ID.
     *
     * @param userId el ID del usuario
     * @return un objeto UserResponse que representa el perfil del usuario
     * @throws EntityNotFoundException si el usuario no existe
     */
    public UserResponse getUserProfileById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + userId));
        return toDtoWithRating(user);
    }
}
